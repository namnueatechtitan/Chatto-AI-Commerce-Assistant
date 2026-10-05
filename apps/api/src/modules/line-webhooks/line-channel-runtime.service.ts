import { Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Channel, Prisma } from "@prisma/client";
import { LineSignatureService } from "./line-signature.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCipherService } from "../../security/credential-cipher.service";

export interface TrustedLineChannel {
  channelId: string;
  merchantId: string;
  revision: number;
  botUserId: string;
}

@Injectable()
export class LineChannelRuntimeService {
  private readonly signatures = new LineSignatureService();
  constructor(private readonly prisma: PrismaService, private readonly cipher: CredentialCipherService) {}

  private async ready(db: Prisma.TransactionClient, channelId: string, merchantId?: string): Promise<Channel> {
    const platforms = await db.$queryRawUnsafe<Array<{ id: string }>>(
      "SELECT id FROM platforms WHERE lower(btrim(code))='line' AND status='active'",
    );
    if (platforms.length !== 1) throw new ServiceUnavailableException("LINE platform is unavailable");
    const channel = await db.channel.findFirst({ where: { id: channelId, ...(merchantId ? { merchantId } : {}),
      platformId: platforms[0].id, merchant: { status: { in: ["ACTIVE", "TRIAL"] } } } });
    if (!channel || !["WEBHOOK_PENDING", "CONNECTED"].includes(channel.status) || channel.credentialRevision < 1 ||
      !channel.externalChannelId || !/^\d{1,255}$/.test(channel.externalChannelId) || !channel.accessTokenEncrypted || !channel.channelSecretEncrypted ||
      !channel.credentialsVerifiedAt || !channel.lineClaimedAt || !channel.lineBotUserId || !/^U[0-9a-f]{32}$/.test(channel.lineBotUserId) ||
      (channel.status === "CONNECTED" && (!channel.isConnected || !channel.webhookVerifiedAt)))
      throw new NotFoundException("Verified LINE channel not found");
    const claims = await db.channel.findMany({ where: { platformId: platforms[0].id,
      OR: [{ externalChannelId: channel.externalChannelId }, { lineBotUserId: channel.lineBotUserId }],
      AND: [{ OR: [{ lineClaimedAt: { not: null } }, { status: "CONNECTED" }] }],
    }, select: { id: true }, take: 2 });
    if (claims.length !== 1 || claims[0].id !== channel.id) throw new NotFoundException("Verified LINE channel not found");
    return channel;
  }

  async authenticate(channelId: string, signature: string | undefined, rawBody: Buffer | undefined) {
    if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) throw new UnauthorizedException("Invalid LINE signature");
    if (!rawBody) throw new ServiceUnavailableException("LINE raw body is unavailable");
    const channel = await this.ready(this.prisma, channelId);
    const secret = this.cipher.decrypt(channel.channelSecretEncrypted!, {
      merchantId: channel.merchantId, channelId: channel.id, field: "channelSecret",
    });
    if (!this.signatures.verifySignature(rawBody, signature, secret)) throw new UnauthorizedException("Invalid LINE signature");
    return { channelId: channel.id, merchantId: channel.merchantId, revision: channel.credentialRevision,
      botUserId: channel.lineBotUserId! } satisfies TrustedLineChannel;
  }

  // Shared with Owner mutations. Disconnect/rotation and outbound delivery cannot
  // race. Merchant suspension also waits for the held policy row lock.
  async locked<T>(context: TrustedLineChannel, action: (db: Prisma.TransactionClient, channel: Channel) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async db => {
      await db.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", "merchant-line:" + context.merchantId.toLowerCase());
      await db.$queryRawUnsafe("SELECT id FROM merchants WHERE id=$1::uuid FOR SHARE", context.merchantId);
      await db.$queryRawUnsafe("SELECT id FROM channels WHERE id=$1::uuid AND merchant_id=$2::uuid FOR UPDATE", context.channelId, context.merchantId);
      const channel = await this.ready(db, context.channelId, context.merchantId);
      if (channel.credentialRevision !== context.revision || channel.lineBotUserId !== context.botUserId)
        throw new NotFoundException("Verified LINE channel changed");
      return action(db, channel);
    }, { timeout: 12000, maxWait: 12000 });
  }

  async accept(context: TrustedLineChannel, destination: unknown): Promise<TrustedLineChannel> {
    if (destination !== context.botUserId) throw new UnauthorizedException("Invalid LINE destination");
    return this.locked(context, async (db, channel) => {
      if (channel.status === "CONNECTED") return context;
      const connected = await db.channel.update({ where: { id: channel.id, merchantId: context.merchantId }, data: {
        status: "CONNECTED", isConnected: true, webhookVerifiedAt: new Date(), credentialRevision: { increment: 1 },
      } });
      return { ...context, revision: connected.credentialRevision };
    });
  }

  accessToken(channel: Channel): string {
    return this.cipher.decrypt(channel.accessTokenEncrypted!, {
      merchantId: channel.merchantId, channelId: channel.id, field: "channelAccessToken",
    });
  }
}
