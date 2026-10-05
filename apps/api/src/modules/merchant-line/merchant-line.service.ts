import { randomUUID, timingSafeEqual } from "node:crypto";
import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Channel, ChannelStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCipherService } from "../../security/credential-cipher.service";
import { StoreInformationService } from "../store-information/store-information.service";
import { ConfigureLineDto } from "./merchant-line.dto";
import { InvalidLineCredentials, LineProviderAdapter } from "./line-provider.adapter";
const inactive: ChannelStatus[] = ["DISCONNECTED", "DISABLED"];
function sameCredential(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8"), rightBytes = Buffer.from(right, "utf8");
  try { return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes); }
  finally { leftBytes.fill(0); rightBytes.fill(0); }
}
function safeMetadata(channel: Channel) {
  const proof = Boolean(channel.credentialRevision > 0 && channel.externalChannelId && /^\d{1,255}$/.test(channel.externalChannelId) &&
    channel.lineBotUserId && /^U[0-9a-f]{32}$/.test(channel.lineBotUserId) && channel.accessTokenEncrypted && channel.channelSecretEncrypted &&
    channel.credentialsVerifiedAt && channel.webhookVerifiedAt && channel.lineBotUserId && channel.lineClaimedAt);
  const legacy = channel.status === "CONNECTED" && (!channel.isConnected || !proof);
  return {
    id: channel.id, externalChannelId: channel.externalChannelId,
    status: legacy ? "ERROR" : channel.status,
    isConnected: channel.status === "CONNECTED" && channel.isConnected && proof,
    hasCredentials: Boolean(channel.accessTokenEncrypted && channel.channelSecretEncrypted),
    revision: channel.credentialRevision, credentialsVerifiedAt: channel.credentialsVerifiedAt,
    webhookVerifiedAt: channel.webhookVerifiedAt, updatedAt: channel.updatedAt,
    issue: legacy ? "LEGACY_UNVERIFIED" : null,
  };
}
@Injectable()
export class MerchantLineService {
  constructor(private readonly prisma: PrismaService, private readonly ownership: StoreInformationService,
    private readonly cipher: CredentialCipherService, private readonly provider: LineProviderAdapter) {}
  private async safe<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2034"].includes(error.code))
        throw new ConflictException("LINE association changed or is unavailable; refresh and retry");
      // Never expose ORM argument dumps, encrypted values or provider response bodies.
      throw new ServiceUnavailableException("LINE configuration is temporarily unavailable");
    }
  }
  private async platform(db: Prisma.TransactionClient, write = false) {
    const rows = await db.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      "SELECT id, status FROM platforms WHERE lower(btrim(code)) = 'line'",
    );
    if (rows.length !== 1 || (write && rows[0].status !== "active")) throw new ServiceUnavailableException("LINE platform is unavailable");
    return rows[0].id;
  }
  private async lock(db: Prisma.TransactionClient, name: string) {
    await db.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", name.toLowerCase());
  }
  private async writeAccess(db: Prisma.TransactionClient, userId: string, merchantId: string) {
    await this.lock(db, "merchant-line:" + merchantId);
    // Hold membership/role/store policy rows until commit. Revocation cannot race
    // between the authorization read and the credential write.
    await db.$queryRawUnsafe(
      "SELECT mu.id FROM merchant_users mu JOIN merchants m ON m.id=mu.merchant_id JOIN roles r ON r.id=mu.role_id WHERE mu.merchant_id=$1::uuid AND mu.user_id=$2::uuid FOR SHARE OF mu,m,r",
      merchantId, userId,
    );
    await this.ownership.authorize(userId, merchantId, true, db);
  }
  private async owned(db: Prisma.TransactionClient, merchantId: string, channelId: string) {
    const platformId = await this.platform(db, true);
    const channel = await db.channel.findFirst({ where: { id: channelId, merchantId, platformId } });
    if (!channel) throw new NotFoundException("LINE channel not found");
    return channel;
  }
  private revision(channel: Channel | null, expected: number) {
    if ((channel?.credentialRevision ?? 0) !== expected) throw new ConflictException("LINE configuration changed; refresh and retry");
  }
  private async unclaimed(db: Prisma.TransactionClient, merchantId: string, platformId: string, identity: string) {
    const claim = await db.channel.findFirst({
      where: { merchantId: { not: merchantId }, platformId, externalChannelId: identity,
        OR: [{ status: "CONNECTED" }, { lineClaimedAt: { not: null } }] },
      select: { id: true },
    });
    if (claim) throw new ConflictException("LINE association is unavailable");
  }
  read(userId: string, merchantId: string) {
    return this.safe(() => this.prisma.$transaction(async (db) => {
      await this.ownership.authorize(userId, merchantId, false, db);
      const platformId = await this.platform(db);
      const current = await db.channel.findFirst({
        where: { merchantId, platformId, status: { notIn: inactive } }, orderBy: { updatedAt: "desc" },
      });
      const history = await db.channel.findMany({
        where: { merchantId, platformId, status: { in: inactive } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 20,
      });
      return { current: current ? safeMetadata(current) : null, history: history.map(safeMetadata) };
    }, { isolationLevel: "RepeatableRead" }));
  }
  configure(userId: string, merchantId: string, input: ConfigureLineDto) {
    return this.safe(() => this.prisma.$transaction(async (db) => {
      await this.writeAccess(db, userId, merchantId);
      // Keep the same safe semantics for trusted in-process callers as for DTO validation.
      if ((input.externalChannelId !== undefined && (typeof input.externalChannelId !== "string" || !/^\d{1,255}$/.test(input.externalChannelId))) ||
        (input.channelSecret !== undefined && (typeof input.channelSecret !== "string" || !/^[0-9a-fA-F]{32}$/.test(input.channelSecret))) ||
        (input.channelAccessToken !== undefined && (typeof input.channelAccessToken !== "string" || !/^[\x21-\x7e]{16,4096}$/.test(input.channelAccessToken))))
        throw new BadRequestException("LINE credentials have an invalid format");
      const platformId = await this.platform(db, true);
      const active = await db.channel.findFirst({ where: { merchantId, platformId, status: { notIn: inactive } } });
      const identity = input.externalChannelId ?? active?.externalChannelId;
      if (!identity) throw new BadRequestException("Channel ID is required to configure LINE");
      if (active && active.externalChannelId !== identity) throw new ConflictException("Disconnect the current LINE channel before configuring another");
      const existing = await db.channel.findUnique({ where: { merchantId_platformId_externalChannelId: { merchantId, platformId, externalChannelId: identity } } });
      this.revision(existing, input.expectedRevision);
      await this.lock(db, "line-oa:" + identity);
      await this.unclaimed(db, merchantId, platformId, identity);
      // An inactive history row is a new connection: never revive its old credentials implicitly.
      if ((!active && (input.channelSecret === undefined || input.channelAccessToken === undefined)) ||
        (input.channelSecret === undefined && !existing?.channelSecretEncrypted) ||
        (input.channelAccessToken === undefined && !existing?.accessTokenEncrypted))
        throw new BadRequestException("Channel ID, Channel Secret and Channel Access Token are required for a new LINE connection");
      const id = existing?.id ?? randomUUID();
      const context = { merchantId, channelId: id };
      // Omitted fields retain their ciphertext without decryption. Supplied fields are
      // compared only on the server, using the same tenant/channel/field AAD binding.
      const tokenChanged = input.channelAccessToken !== undefined && (!active || !existing?.accessTokenEncrypted ||
        !sameCredential(this.cipher.decrypt(existing.accessTokenEncrypted, { ...context, field: "channelAccessToken" }), input.channelAccessToken));
      const secretChanged = input.channelSecret !== undefined && (!active || !existing?.channelSecretEncrypted ||
        !sameCredential(this.cipher.decrypt(existing.channelSecretEncrypted, { ...context, field: "channelSecret" }), input.channelSecret));
      if (active && existing && !tokenChanged && !secretChanged) return safeMetadata(existing);
      const data = {
        ...(tokenChanged ? { accessTokenEncrypted: this.cipher.encrypt(input.channelAccessToken!, { ...context, field: "channelAccessToken" }) } : {}),
        ...(secretChanged ? { channelSecretEncrypted: this.cipher.encrypt(input.channelSecret!, { ...context, field: "channelSecret" }) } : {}),
        refreshTokenEncrypted: null, webhookUrl: null,
        isConnected: false, status: "CONFIGURED" as const, credentialRevision: (existing?.credentialRevision ?? 0) + 1,
        credentialsVerifiedAt: null, webhookVerifiedAt: null,
        lineBotUserId: existing?.lineClaimedAt ? existing.lineBotUserId : null,
        // A verified owner keeps its reservation during rotation/error until explicit disconnect.
        lineClaimedAt: existing?.lineClaimedAt ?? (existing?.status === "CONNECTED" ? new Date() : null),
      };
      const channel = existing
        ? await db.channel.update({ where: { id, merchantId }, data })
        : await db.channel.create({ data: { id, merchantId, platformId, externalChannelId: identity, channelName: "LINE Official Account", ...data } });
      return safeMetadata(channel);
    }));
  }
  async verify(userId: string, merchantId: string, channelId: string, expected: number) {
    return this.safe(async () => {
      // Provider I/O runs outside the transaction; revision and authorization are checked again afterward.
      await this.ownership.authorize(userId, merchantId, true);
      const snapshot = await this.owned(this.prisma, merchantId, channelId);
      this.revision(snapshot, expected);
      if (inactive.includes(snapshot.status) || !snapshot.accessTokenEncrypted || !snapshot.channelSecretEncrypted || !snapshot.externalChannelId)
        throw new ConflictException("Configure LINE credentials before verification");
      const context = { merchantId, channelId };
      let verified;
      try {
        verified = await this.provider.verify({
          externalChannelId: snapshot.externalChannelId,
          channelAccessToken: this.cipher.decrypt(snapshot.accessTokenEncrypted, { ...context, field: "channelAccessToken" }),
          channelSecret: this.cipher.decrypt(snapshot.channelSecretEncrypted, { ...context, field: "channelSecret" }),
        });
      } catch (error) {
        if (!(error instanceof InvalidLineCredentials)) throw error;
        await this.prisma.$transaction(async (db) => {
          await this.writeAccess(db, userId, merchantId);
          const current = await this.owned(db, merchantId, channelId);
          this.revision(current, expected);
          await db.channel.update({ where: { id: channelId, merchantId },
            data: { status: "ERROR", isConnected: false, credentialsVerifiedAt: null, webhookVerifiedAt: null,
              lineBotUserId: current.lineClaimedAt ? current.lineBotUserId : null, credentialRevision: { increment: 1 } } });
        });
        throw error;
      }
      return this.prisma.$transaction(async (db) => {
        await this.writeAccess(db, userId, merchantId);
        const current = await this.owned(db, merchantId, channelId);
        this.revision(current, expected);
        if (inactive.includes(current.status)) throw new ConflictException("LINE configuration changed; refresh and retry");
        if (current.lineClaimedAt && current.lineBotUserId && current.lineBotUserId !== verified.botUserId)
          throw new ConflictException("LINE association is unavailable");
        await this.lock(db, "line-oa:" + current.externalChannelId);
        await this.unclaimed(db, merchantId, current.platformId, current.externalChannelId!);
        const channel = await db.channel.update({ where: { id: channelId, merchantId }, data: {
          status: "WEBHOOK_PENDING", isConnected: false, credentialsVerifiedAt: new Date(),
          webhookVerifiedAt: null, lineBotUserId: verified.botUserId, lineClaimedAt: current.lineClaimedAt ?? new Date(),
          credentialRevision: { increment: 1 },
        } });
        return safeMetadata(channel);
      });
    });
  }
  disconnect(userId: string, merchantId: string, channelId: string, expected: number) {
    return this.safe(() => this.prisma.$transaction(async (db) => {
      await this.writeAccess(db, userId, merchantId);
      const current = await this.owned(db, merchantId, channelId);
      this.revision(current, expected);
      const channel = await db.channel.update({ where: { id: channelId, merchantId }, data: {
        status: "DISCONNECTED", isConnected: false, credentialRevision: { increment: 1 },
        accessTokenEncrypted: null, channelSecretEncrypted: null, refreshTokenEncrypted: null,
        credentialsVerifiedAt: null, webhookVerifiedAt: null, webhookUrl: null, lineBotUserId: null, lineClaimedAt: null,
      } });
      return safeMetadata(channel);
    }));
  }
}
