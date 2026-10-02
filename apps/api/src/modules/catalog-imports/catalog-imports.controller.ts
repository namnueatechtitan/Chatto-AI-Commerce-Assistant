import { Controller, Get, Header, Param, ParseUUIDPipe, Post, Req, Res, BadRequestException } from "@nestjs/common";
import type { Request, Response } from "express";
import multer from "multer";
import { Workbook } from "exceljs";
import { AuthSessionService, SESSION_COOKIE } from "../../auth/auth-session.service";
import { readCookie, requireWebOrigin } from "../../auth/auth-http";
import { StoreInformationService } from "../store-information/store-information.service";
import { CatalogImportsService } from "./catalog-imports.service";
import { CATALOG_LIMITS } from "./catalog-types";

@Controller("merchants/:merchantId/catalog-imports")
export class CatalogImportsController {
  constructor(private readonly sessions: AuthSessionService, private readonly information: StoreInformationService, private readonly imports: CatalogImportsService) {}
  private async user(request: Request, write = false) {
    if (write) requireWebOrigin(request);
    return (await this.sessions.profile(readCookie(request, SESSION_COOKIE))).user;
  }
  @Get() @Header("Cache-Control", "no-store")
  async list(@Req() request: Request, @Param("merchantId", ParseUUIDPipe) merchantId: string) {
    return { imports: await this.imports.list((await this.user(request)).id, merchantId) };
  }
  @Get("template/:format")
  async template(@Req() request: Request, @Res() response: Response, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Param("format") format: string) {
    await this.information.authorize((await this.user(request)).id, merchantId);
    if (!["csv", "xlsx"].includes(format)) throw new BadRequestException("Template format must be csv or xlsx.");
    const rows = [["name", "description", "category", "brand"], ["ดอกไม้ช่อเล็ก", "ช่อดอกไม้สด", "flowers", "Chatto"]];
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Disposition", `attachment; filename="chatto-catalog.${format}"`);
    if (format === "csv") {
      // Escape formula prefixes for every exported cell, including future template values.
      const csv = rows.map((row) => row.map((value) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`).join(",")).join("\r\n");
      response.type("text/csv; charset=utf-8").send(`\uFEFF${csv}\r\n`);
    } else {
      const workbook = new Workbook(); const sheet = workbook.addWorksheet("Catalog"); sheet.addRows(rows);
      sheet.columns.forEach((column) => { column.width = 28; });
      response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(Buffer.from(await workbook.xlsx.writeBuffer()));
    }
  }
  @Post() @Header("Cache-Control", "no-store")
  async upload(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Param("merchantId", ParseUUIDPipe) merchantId: string) {
    const user = await this.user(request, true);
    await this.information.authorize(user.id, merchantId, true);
    const release = this.imports.reserveUpload();
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new BadRequestException("Upload exceeded the 30-second limit."));
          request.destroy();
        }, 30000);
        multer({ storage: multer.memoryStorage(), limits: { fileSize: CATALOG_LIMITS.bytes, files: 1, fields: 0, parts: 1, fieldNameSize: 50, headerPairs: 20 } })
          .single("file")(request, response, (error: unknown) => {
            clearTimeout(timeout);
            error ? reject(new BadRequestException(error instanceof Error ? error.message : "Invalid upload")) : resolve();
          });
      });
      if (!request.file) throw new BadRequestException("Choose a CSV, XLSX or PDF file.");
      response.status(202);
      return { import: await this.imports.upload(user.id, merchantId, request.file) };
    } finally { release(); }
  }
  @Get(":importId") @Header("Cache-Control", "no-store")
  async read(@Req() request: Request, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Param("importId", ParseUUIDPipe) id: string) {
    return { import: await this.imports.read((await this.user(request)).id, merchantId, id) };
  }
  @Post(":importId/confirm") @Header("Cache-Control", "no-store")
  async confirm(@Req() request: Request, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Param("importId", ParseUUIDPipe) id: string) {
    return { import: await this.imports.confirm((await this.user(request, true)).id, merchantId, id) };
  }
  @Post(":importId/cancel") @Header("Cache-Control", "no-store")
  async cancel(@Req() request: Request, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Param("importId", ParseUUIDPipe) id: string) {
    return { import: await this.imports.cancel((await this.user(request, true)).id, merchantId, id) };
  }
}
