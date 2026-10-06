import { BadRequestException, CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AuthSessionService, SESSION_COOKIE } from "../../auth/auth-session.service";
import { readCookie, requireWebOrigin } from "../../auth/auth-http";
export type ActivationRequest = Request & { activationUserId: string };
@Injectable()
export class MerchantActivationGuard implements CanActivate {
  constructor(private readonly sessions: AuthSessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ActivationRequest>();
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    request.activationUserId = user.id;
    if (Object.keys(request.query).length) throw new BadRequestException("Query parameters are not supported");
    if (request.method !== "GET") {
      requireWebOrigin(request);
      // Reject tenant/actor/readiness/enabled fields before the global whitelist.
      const body: unknown = request.body;
      if (body === null || (body !== undefined && (typeof body !== "object" || Array.isArray(body) || Object.keys(body).length)))
        throw new BadRequestException("Activation requires an empty JSON object");
    }
    return true;
  }
}
