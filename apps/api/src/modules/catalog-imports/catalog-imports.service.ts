import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile, unlink, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Worker } from "node:worker_threads";
import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StoreInformationService } from "../store-information/store-information.service";
import { CATALOG_LIMITS, CatalogFormat, CatalogPreview, productKey } from "./catalog-types";

const jobSelect = {
  id: true, merchantId: true, originalName: true, format: true, status: true, preview: true, error: true,
  createdCount: true, updatedCount: true, rejectedCount: true, createdAt: true, updatedAt: true, confirmedAt: true, expiresAt: true,
} as const;
const MIME: Record<CatalogFormat, string[]> = {
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], pdf: ["application/pdf"],
};
export function validateCatalogFile(file: Express.Multer.File): CatalogFormat {
  if (!file.size || file.size > CATALOG_LIMITS.bytes) throw new BadRequestException("File must be between 1 byte and 5 MB.");
  const format = file.originalname.split(".").pop()?.toLowerCase() as CatalogFormat;
  if (!Object.hasOwn(MIME, format) || !MIME[format].includes(file.mimetype.toLowerCase())) throw new BadRequestException("File extension and MIME must match CSV, XLSX or PDF.");
  const signature = file.buffer.subarray(0, 5);
  if (format === "pdf" && signature.toString("ascii") !== "%PDF-") throw new BadRequestException("Invalid PDF signature.");
  if (format === "xlsx" && !signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new BadRequestException("Invalid XLSX signature. Encrypted workbooks are unsupported.");
  if (format === "csv") {
    try { if (new TextDecoder("utf-8", { fatal: true }).decode(file.buffer).includes("\0")) throw new Error(); }
    catch { throw new BadRequestException("CSV must contain UTF-8 text."); }
  }
  return format;
}
@Injectable()
export class CatalogImportsService implements OnModuleInit, OnModuleDestroy {
  private readonly directory = resolve(process.env.CATALOG_STORAGE_DIR || join(process.cwd(), "storage", "catalog"));
  private readonly workers = new Map<string, Worker>();
  private cleanupTimer?: NodeJS.Timeout;
  private accepting = true;
  private uploads = 0;
  constructor(private readonly prisma: PrismaService, private readonly information: StoreInformationService) {}

  async onModuleInit() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.cleanup();
    this.cleanupTimer = setInterval(() => { void this.cleanup().catch(() => undefined); }, 60000).unref();
  }
  async onModuleDestroy() {
    this.accepting = false;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await Promise.all([...this.workers.values()].map((worker) => worker.terminate()));
  }
  // Reserve capacity before buffering multipart content. Two uploads/parsers per API process.
  reserveUpload() {
    if (!this.accepting || this.uploads + this.workers.size >= 2) throw new ServiceUnavailableException("Catalog parser is busy. Please retry shortly.");
    this.uploads++;
    return () => { this.uploads--; };
  }
  private filePath(key: string) {
    if (!/^[0-9a-f-]{36}\.upload$/.test(key)) throw new Error("Invalid storage key");
    return join(this.directory, key);
  }
  private async cleanup() {
    const now = new Date();
    await this.prisma.catalogImport.updateMany({ where: { status: "PARSING", updatedAt: { lt: new Date(Date.now() - 60000) } }, data: { status: "FAILED", error: "Parsing was interrupted. Upload the file again to retry.", storageKey: null } });
    await this.prisma.catalogImport.updateMany({ where: { status: "PREVIEW", expiresAt: { lt: now } }, data: { status: "FAILED", error: "Preview expired. Upload the file again to retry." } });
    for (const key of await readdir(this.directory)) {
      if (!/^[0-9a-f-]{36}\.upload$/.test(key)) continue;
      const path = this.filePath(key);
      const file = await stat(path).catch(() => null);
      if (file && file.mtimeMs < Date.now() - 120000) await unlink(path).catch(() => undefined);
    }
  }
  async list(userId: string, merchantId: string) {
    await this.information.authorize(userId, merchantId);
    return this.prisma.catalogImport.findMany({ where: { merchantId }, select: { ...jobSelect, preview: false }, orderBy: { createdAt: "desc" }, take: 20 });
  }
  async read(userId: string, merchantId: string, id: string) {
    await this.information.authorize(userId, merchantId);
    const job = await this.prisma.catalogImport.findFirst({ where: { id, merchantId }, select: jobSelect });
    if (!job) throw new NotFoundException("Catalog import not found");
    return job;
  }
  async upload(userId: string, merchantId: string, file: Express.Multer.File) {
    await this.information.authorize(userId, merchantId, true);
    const format = validateCatalogFile(file);
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const key = `${randomUUID()}.upload`;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(this.filePath(key), file.buffer, { flag: "wx", mode: 0o600 });
    let parse = false;
    try {
      const job = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${merchantId}))`;
        await this.information.authorize(userId, merchantId, true, tx);
        const existing = await tx.catalogImport.findUnique({ where: { merchantId_sha256: { merchantId, sha256 } } });
        if (existing && ["PARSING", "PREVIEW", "IMPORTED"].includes(existing.status) && (existing.status !== "PREVIEW" || existing.expiresAt > new Date())) return tx.catalogImport.findUniqueOrThrow({ where: { id: existing.id }, select: jobSelect });
        parse = true;
        const data = { uploadedById: userId, originalName: file.originalname.replace(/^.*[\\/]/, "").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 255) || `catalog.${format}`,
          format, mimeType: file.mimetype, byteSize: file.size, storageKey: key, status: "PARSING", expiresAt: new Date(Date.now() + 86400000), error: null, preview: Prisma.DbNull,
          createdCount: 0, updatedCount: 0, rejectedCount: 0, confirmedAt: null, confirmedById: null };
        return existing ? tx.catalogImport.update({ where: { id: existing.id }, data, select: jobSelect }) : tx.catalogImport.create({ data: { ...data, merchantId, sha256 }, select: jobSelect });
      });
      if (parse) this.startParser(job.id, key, format);
      else await unlink(this.filePath(key));
      return job;
    } catch (error) { await unlink(this.filePath(key)).catch(() => undefined); throw error; }
  }
  private startParser(id: string, key: string, format: CatalogFormat) {
    const compiledWorker = join(__dirname, "catalog-parser.worker.js");
    const development = !existsSync(compiledWorker);
    const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT;
    const worker = new Worker(development ? join(__dirname, "catalog-parser.worker.ts") : compiledWorker, {
      workerData: { path: this.filePath(key), format },
      execArgv: development ? ["-r", require.resolve("ts-node/register/transpile-only")] : [],
      // Parser workers do not need database credentials, OAuth secrets or service tokens.
      env: { NODE_ENV: process.env.NODE_ENV || "development", TEMP: tmpdir(), TMP: tmpdir(), TMPDIR: tmpdir(),
        ...(systemRoot ? { SystemRoot: systemRoot } : {}),
        ...(development ? { TS_NODE_PROJECT: join(__dirname, "../../../tsconfig.json") } : {}) },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
    });
    this.workers.set(id, worker);
    let settled = false;
    const finish = async (result: { preview?: CatalogPreview; error?: string }) => {
      if (settled) return; settled = true; clearTimeout(timeout);
      await worker.terminate();
      if (this.workers.get(id) === worker) this.workers.delete(id);
      // The persisted preview is sufficient; retain no original file after parsing.
      await unlink(this.filePath(key)).catch(() => undefined);
      try {
        if (result.preview) {
          const job = await this.prisma.catalogImport.findUnique({ where: { id }, select: { merchantId: true, status: true } });
          if (job?.status === "PARSING") {
            const products = await this.prisma.product.findMany({ where: { merchantId: job.merchantId }, select: { name: true } });
            const counts = new Map<string, number>();
            for (const product of products) { const key = productKey(product.name); counts.set(key, (counts.get(key) ?? 0) + 1); }
            for (const row of result.preview.rows) {
              const count = counts.get(productKey(row.product.name)) ?? 0;
              if (count > 1) row.errors.push("Multiple existing products match this name. Resolve the duplicate names first.");
              else if (count === 1) row.warnings.push("Updates the existing product with this normalized name.");
            }
            result.preview.validCount = result.preview.rows.filter((row) => !row.errors.length).length;
          }
        }
        await this.prisma.catalogImport.updateMany({ where: { id, status: "PARSING", storageKey: key }, data: {
          status: result.preview ? "PREVIEW" : "FAILED", preview: result.preview ? result.preview as unknown as Prisma.InputJsonValue : Prisma.DbNull,
          error: result.error?.slice(0, 500) ?? null, storageKey: null,
        } });
      } finally { await unlink(this.filePath(key)).catch(() => undefined); }
    };
    const timeout = setTimeout(() => { void finish({ error: "Parser exceeded the 15-second resource limit. Use a smaller file." }).catch(() => undefined); }, CATALOG_LIMITS.timeoutMs);
    worker.once("message", (result: { preview?: CatalogPreview; error?: string }) => { void finish(result).catch(() => undefined); });
    worker.once("error", () => { void finish({ error: "Catalog parser failed or exceeded its memory limit. Use a smaller file." }).catch(() => undefined); });
    worker.once("exit", () => { if (!settled) void finish({ error: "Catalog parsing was interrupted. Re-upload to retry." }).catch(() => undefined); });
  }
  async cancel(userId: string, merchantId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${merchantId}))`;
      await this.information.authorize(userId, merchantId, true, tx);
      const job = await tx.catalogImport.findFirst({ where: { id, merchantId }, select: { status: true } });
      if (!job) throw new NotFoundException("Catalog import not found");
      if (job.status === "IMPORTED") throw new ConflictException("An imported catalog cannot be cancelled.");
      await tx.catalogImport.update({ where: { id }, data: { status: "CANCELLED", storageKey: null } });
    });
    const worker = this.workers.get(id); if (worker) await worker.terminate();
    return this.read(userId, merchantId, id);
  }
  async confirm(userId: string, merchantId: string, id: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${merchantId}))`;
        await this.information.authorize(userId, merchantId, true, tx);
        const job = await tx.catalogImport.findFirst({ where: { id, merchantId } });
        if (!job) throw new NotFoundException("Catalog import not found");
        if (job.status === "IMPORTED") return;
        if (job.status !== "PREVIEW" || job.expiresAt <= new Date()) throw new ConflictException("Import preview is unavailable or expired. Upload again.");
        const preview = job.preview as unknown as CatalogPreview;
        if (!preview.validCount) throw new BadRequestException("No valid products to import.");
        const existing = await tx.product.findMany({ where: { merchantId }, select: { id: true, name: true } });
        const matches = new Map<string, string[]>();
        for (const product of existing) { const key = productKey(product.name); matches.set(key, [...(matches.get(key) ?? []), product.id]); }
        let createdCount = 0, updatedCount = 0, rejectedCount = 0;
        for (const row of preview.rows) {
          if (row.errors.length) { rejectedCount++; continue; }
          const ids = matches.get(productKey(row.product.name)) ?? [];
          if (ids.length > 1) throw new ConflictException(`Multiple existing products match '${row.product.name}'. Resolve the duplicate names before importing.`);
          if (ids.length) {
            const changes: Prisma.ProductUpdateInput = { name: row.product.name };
            for (const field of ["description", "category", "brand"] as const) if (preview.fields.includes(field)) changes[field] = row.product[field];
            await tx.product.update({ where: { id: ids[0] }, data: changes }); updatedCount++;
          }
          else { const product = await tx.product.create({ data: { ...row.product, merchantId, status: "DRAFT" } }); matches.set(productKey(product.name), [product.id]); createdCount++; }
        }
        await tx.catalogImport.update({ where: { id }, data: { status: "IMPORTED", createdCount, updatedCount, rejectedCount, confirmedAt: new Date(), confirmedById: userId, error: null } });
      }, { timeout: 30000 });
    } catch (error) {
      // Persist transient/ambiguous confirmation failures without discarding the reviewable preview.
      if (error instanceof ConflictException || !(error instanceof HttpException)) {
        await this.prisma.catalogImport.updateMany({ where: { id, merchantId, status: "PREVIEW", merchant: { status: { in: ["ACTIVE", "TRIAL"] }, merchantUsers: { some: { userId, status: "ACTIVE", role: { name: "Owner" } } } } }, data: { error: error instanceof ConflictException ? error.message.slice(0, 500) : "Import failed; no products were changed. Please retry." } });
      }
      throw error;
    }
    return this.read(userId, merchantId, id);
  }
}
