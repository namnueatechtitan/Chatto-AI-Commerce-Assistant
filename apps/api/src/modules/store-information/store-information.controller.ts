import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthSessionService, SESSION_COOKIE } from "../../auth/auth-session.service";
import { readCookie, requireWebOrigin } from "../../auth/auth-http";
import { UpdateStoreInformationDto } from "./store-information.dto";
import { StoreInformationService } from "./store-information.service";
@Controller("merchants/:merchantId/information")
export class StoreInformationController {
  constructor(private readonly sessions: AuthSessionService, private readonly information: StoreInformationService) {}
  @Get() @Header("Cache-Control", "no-store")
  async read(@Req() request: Request, @Param("merchantId", ParseUUIDPipe) merchantId: string) {
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    return this.information.read(user.id, merchantId);
  }
  @Patch() @Header("Cache-Control", "no-store")
  async update(@Req() request: Request, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Body() input: UpdateStoreInformationDto) {
    requireWebOrigin(request);
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    return this.information.update(user.id, merchantId, input);
  }
}
