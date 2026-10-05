import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MerchantsService } from "../merchants.module";
import { buildOnboardingProgress } from "./onboarding-status";
import { storeInformationReady } from "../store-information/store-information.service";

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService, private readonly merchants: MerchantsService) {}

  async status(userId: string, merchantId?: string) {
    const memberships = await this.merchants.findForUser(userId);
    const selected = merchantId
      ? memberships.find(({ merchant }) => merchant.id === merchantId)
      : memberships.length === 1 ? memberships[0] : undefined;
    if (merchantId && !selected) throw new NotFoundException("Merchant not found");

    let lineReady = false;
    let contextReady = false;
    let storeReady = false;
    if (selected) {
      const hasOwner = selected.role.name === "Owner" || (await this.merchants.findOwners(selected.merchant.id)).length > 0;
      storeReady = storeInformationReady(selected.merchant, hasOwner ? "Owner" : "");
    }
    if (selected && ["ACTIVE", "TRIAL"].includes(selected.merchant.status)) {
      const id = selected.merchant.id;
      const platforms = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        "SELECT id FROM platforms WHERE lower(btrim(code))='line' AND status='active'",
      );
      const [channel, settings, product, documents] = await Promise.all([
        platforms.length === 1 ? this.prisma.channel.findFirst({
          where: {
            merchantId: id, platformId: platforms[0].id, credentialRevision: { gt: 0 },
            isConnected: true, status: "CONNECTED", externalChannelId: { not: null },
            accessTokenEncrypted: { not: null }, channelSecretEncrypted: { not: null },
            credentialsVerifiedAt: { not: null }, webhookVerifiedAt: { not: null },
            lineBotUserId: { not: null }, lineClaimedAt: { not: null },
          },
          select: { id: true },
        }) : Promise.resolve(null),
        this.prisma.aiSetting.findUnique({ where: { merchantId: id }, select: { botName: true, language: true } }),
        this.prisma.product.findFirst({ where: { merchantId: id, status: "ACTIVE" }, select: { id: true } }),
        this.prisma.knowledgeBaseDocument.findMany({ where: { merchantId: id, status: "ACTIVE" }, select: { content: true } }),
      ]);
      lineReady = channel !== null;
      contextReady = Boolean(settings?.botName.trim() && settings.language.trim() &&
        (product || documents.some(({ content }) => content.trim().length > 0)));
    }

    return {
      memberships, merchant: selected?.merchant ?? null, role: selected?.role.name ?? null,
      ...buildOnboardingProgress({ store: storeReady, line: lineReady, context: contextReady, activation: false }),
      // The current schema has no explicit activation confirmation. Never infer it
      // from Merchant.status, a seeded channel, or merely visiting this endpoint.
      capabilities: { lineSetup: true, contextSetup: false, activation: false },
    };
  }
}
