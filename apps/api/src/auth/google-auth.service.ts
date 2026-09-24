import { randomBytes, createHash } from "node:crypto";
import { ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";
import { PrismaService } from "../prisma/prisma.service";
import { hashToken, publicUserSelect } from "./auth-session.service";
import { webOrigin } from "./auth-http";

export const GOOGLE_FLOW_COOKIE = "chatto_google_flow";
export const GOOGLE_FLOW_MAX_AGE = 10 * 60 * 1000;

@Injectable()
export class GoogleAuthService {
  constructor(private readonly prisma: PrismaService) {}

  private client(): OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException("Google sign-in is not configured");
    }
    if (redirectUri !== `${webOrigin()}/api/auth/google/callback`) {
      throw new ServiceUnavailableException("GOOGLE_REDIRECT_URI must match the web callback URL");
    }
    return new OAuth2Client({ clientId, clientSecret, redirectUri });
  }

  async start() {
    const client = this.client();
    const state = randomBytes(32).toString("base64url");
    const browserToken = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    await this.prisma.googleOAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await this.prisma.googleOAuthAttempt.create({ data: {
      stateHash: hashToken(state), browserHash: hashToken(browserToken), verifier, nonce,
      expiresAt: new Date(Date.now() + GOOGLE_FLOW_MAX_AGE),
    } });
    const url = client.generateAuthUrl({
      scope: ["openid", "email", "profile"], state, nonce, prompt: "select_account",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: CodeChallengeMethod.S256,
    });
    return { url, browserToken };
  }

  async complete(state: string | undefined, browserToken: string | undefined, code?: string, providerError?: string) {
    if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state) || !browserToken) {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    const where = { stateHash: hashToken(state), browserHash: hashToken(browserToken), expiresAt: { gt: new Date() } };
    const attempt = await this.prisma.googleOAuthAttempt.findFirst({ where });
    if (!attempt) throw new UnauthorizedException("Expired or invalid OAuth state");
    // Atomic consumption prevents concurrent callbacks from reusing a flow.
    const consumed = await this.prisma.googleOAuthAttempt.deleteMany({ where });
    if (consumed.count !== 1 || providerError || !code) {
      throw new UnauthorizedException("Google sign-in was cancelled or invalid");
    }
    const client = this.client();
    const { tokens } = await client.getToken({ code, codeVerifier: attempt.verifier });
    if (!tokens.id_token) throw new UnauthorizedException("Missing Google identity");
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID?.trim() });
    const identity = ticket.getPayload();
    if (!identity || !identity.sub || !identity.email || identity.email_verified !== true ||
        !("nonce" in identity) || identity.nonce !== attempt.nonce) {
      throw new UnauthorizedException("Invalid Google identity");
    }
    const existing = await this.prisma.user.findUnique({ where: { googleId: identity.sub }, select: publicUserSelect });
    if (existing) {
      if (existing.status !== "ACTIVE") throw new UnauthorizedException("Account unavailable");
      return existing;
    }
    // Never link an existing password account solely because its email matches.
    const email = identity.email.toLowerCase();
    const emailOwner = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (emailOwner) throw new ConflictException("Existing account requires Google linking by an administrator");
    try {
      return await this.prisma.user.create({ data: {
        googleId: identity.sub, email, name: (identity.name || email).slice(0, 255), globalRole: "merchant_user",
      }, select: publicUserSelect });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Account already exists; please sign in again");
      }
      throw error;
    }
  }
}
