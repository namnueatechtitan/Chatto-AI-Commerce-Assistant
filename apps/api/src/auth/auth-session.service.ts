import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export const SESSION_COOKIE = "chatto_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const publicUserSelect = {
  id: true, name: true, email: true, globalRole: true, status: true,
} as const;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, previousToken?: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.$transaction([
      this.prisma.authSession.deleteMany({
        where: { OR: [
          { expiresAt: { lte: new Date() } },
          ...(previousToken ? [{ tokenHash: hashToken(previousToken) }] : []),
        ] },
      }),
      this.prisma.authSession.create({ data: {
        tokenHash: hashToken(token), userId,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE),
      } }),
    ]);
    return token;
  }

  async profile(token?: string) {
    if (!token) throw new UnauthorizedException("Please sign in");
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: publicUserSelect } },
    });
    if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Session expired or account unavailable");
    }
    return { user: session.user };
  }

  async revoke(token?: string): Promise<void> {
    if (token) await this.prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
}
