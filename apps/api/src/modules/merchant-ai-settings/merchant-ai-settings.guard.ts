import { BadRequestException, CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AuthSessionService, SESSION_COOKIE } from "../../auth/auth-session.service";
import { readCookie, requireWebOrigin } from "../../auth/auth-http";
export type AiSettingsRequest = Request & { aiSettingsUserId: string };
const fields = ["assistantName", "pronoun", "tone", "language", "useEmoji", "responseLength", "capabilities", "rules", "fallbackBehavior"];
const capabilityFields = ["recommendProducts", "checkStock", "compareProducts", "answerFaq", "showPrices", "rememberCustomerInterest", "showPromotions", "recommendRelatedProducts"];
function keysAllowed(value: unknown, allowed: string[]) {
  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).some(key => !allowed.includes(key)))
    throw new BadRequestException("Unsupported AI settings field");
}
@Injectable()
export class MerchantAiSettingsGuard implements CanActivate {
  constructor(private readonly sessions: AuthSessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AiSettingsRequest>();
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    request.aiSettingsUserId = user.id;
    if (Object.keys(request.query).length) throw new BadRequestException("Query parameters are not supported");
    if (request.method !== "GET") {
      requireWebOrigin(request);
      // Inspect before the global whitelist strips unknown fields. Client tenant
      // and user IDs are rejected, never used as authorization authority.
      keysAllowed(request.body, fields);
      keysAllowed(request.body?.capabilities, capabilityFields);
      if (Array.isArray(request.body?.rules)) for (const rule of request.body.rules) keysAllowed(rule, ["id", "text"]);
    }
    return true;
  }
}
