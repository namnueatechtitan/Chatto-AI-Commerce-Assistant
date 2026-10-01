import { createHash, randomBytes } from "node:crypto";
import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { hashToken, publicUserSelect } from "./auth-session.service";
import { webOrigin } from "./auth-http";

export const LINE_FLOW_COOKIE = "chatto_line_flow";
export const LINE_FLOW_MAX_AGE = 10 * 60 * 1000;

@Injectable()
export class LineAuthService {
  constructor(private readonly prisma: PrismaService) {}

  private configuration() {
    const clientId = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
    const clientSecret = process.env.LINE_LOGIN_CHANNEL_SECRET?.trim();
    const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI?.trim();
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException("LINE sign-in is not configured");
    }
    if (redirectUri !== `${webOrigin()}/api/auth/line/callback`) {
      throw new ServiceUnavailableException("LINE_LOGIN_REDIRECT_URI must match the web callback URL");
    }
    return { clientId, clientSecret, redirectUri };
  }

  async start() {
    const { clientId, redirectUri } = this.configuration();
    const state = randomBytes(32).toString("base64url");
    const browserToken = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    await this.prisma.lineOAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await this.prisma.lineOAuthAttempt.create({ data: {
      stateHash: hashToken(state), browserHash: hashToken(browserToken), verifier, nonce,
      expiresAt: new Date(Date.now() + LINE_FLOW_MAX_AGE),
    } });
    const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
    url.search = new URLSearchParams({
      response_type: "code", client_id: clientId, redirect_uri: redirectUri,
      scope: "openid profile", state, nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return { url: url.toString(), browserToken };
  }

  private async post(endpoint: "token" | "verify", parameters: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await fetch(`https://api.line.me/oauth2/v2.1/${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(parameters), signal: AbortSignal.timeout(10000), redirect: "error",
    });
    if (!response.ok) throw new UnauthorizedException("LINE identity verification failed");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new UnauthorizedException("Invalid LINE response");
    }
    return data as Record<string, unknown>;
  }

  async complete(state: string | undefined, browserToken: string | undefined, code?: string, providerError?: string) {
    if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state) ||
        !browserToken || !/^[A-Za-z0-9_-]{43}$/.test(browserToken)) {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    const where = { stateHash: hashToken(state), browserHash: hashToken(browserToken), expiresAt: { gt: new Date() } };
    const attempt = await this.prisma.lineOAuthAttempt.findFirst({ where });
    if (!attempt) throw new UnauthorizedException("Expired or invalid OAuth state");
    const consumed = await this.prisma.lineOAuthAttempt.deleteMany({ where });
    if (consumed.count !== 1 || providerError || !code) {
      throw new UnauthorizedException("LINE sign-in was cancelled or invalid");
    }

    const { clientId, clientSecret, redirectUri } = this.configuration();
    const tokens = await this.post("token", {
      grant_type: "authorization_code", code, redirect_uri: redirectUri,
      client_id: clientId, client_secret: clientSecret, code_verifier: attempt.verifier,
    });
    if (typeof tokens.id_token !== "string" || !tokens.id_token) {
      throw new UnauthorizedException("Missing LINE identity");
    }
    
    const identity = await this.post("verify", {
      id_token: tokens.id_token, client_id: clientId, nonce: attempt.nonce,
    });
    const now = Math.floor(Date.now() / 1000);
    if (identity.iss !== "https://access.line.me" || identity.aud !== clientId ||
        identity.nonce !== attempt.nonce || typeof identity.sub !== "string" ||
        !identity.sub.trim() || identity.sub.length > 255 ||
        typeof identity.exp !== "number" || !Number.isFinite(identity.exp) || identity.exp <= now ||
        typeof identity.iat !== "number" || !Number.isFinite(identity.iat) || identity.iat > now + 60) {
      throw new UnauthorizedException("Invalid LINE identity");
    }

    const existing = await this.prisma.user.findUnique({ where: { lineId: identity.sub }, select: publicUserSelect });
    if (existing) {
      if (existing.status !== "ACTIVE") throw new UnauthorizedException("Account unavailable");
      return existing;
    }
    
    try {
      return await this.prisma.user.create({ data: {
        lineId: identity.sub, email: null,
        name: (typeof identity.name === "string" && identity.name.trim() ? identity.name.trim() : "LINE user").slice(0, 255),
        globalRole: "merchant_user",
      }, select: publicUserSelect });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const user = await this.prisma.user.findUnique({ where: { lineId: identity.sub }, select: publicUserSelect });
        if (user?.status === "ACTIVE") return user;
        throw new UnauthorizedException("Account unavailable");
      }
      throw error;
    }
  }
}
