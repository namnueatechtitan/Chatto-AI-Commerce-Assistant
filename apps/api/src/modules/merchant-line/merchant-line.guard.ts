import { BadRequestException, CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { isUUID } from "class-validator";
import { AuthSessionService, SESSION_COOKIE } from "../../auth/auth-session.service";
import { readCookie, requireWebOrigin } from "../../auth/auth-http";
import { StoreInformationService } from "../store-information/store-information.service";
export type LineRequest = Request & { lineUserId: string };
@Injectable()
export class MerchantLineGuard implements CanActivate {
  constructor(private readonly sessions: AuthSessionService, private readonly ownership: StoreInformationService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LineRequest>();
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    const merchantId = request.params.merchantId.toLowerCase();
    if (!isUUID(merchantId)) throw new BadRequestException("Invalid merchant identity");
    request.params.merchantId = merchantId;
    if (request.params.channelId) request.params.channelId = request.params.channelId.toLowerCase();
    const write = request.method !== "GET";
    if (write) requireWebOrigin(request);
    await this.ownership.authorize(user.id, merchantId, write);
    request.lineUserId = user.id;
    return true;
  }
}
