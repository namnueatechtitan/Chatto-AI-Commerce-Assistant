import type { Prisma } from "@prisma/client";
import { storeInformationReady } from "../store-information/store-information.service";
import { AI_FALLBACKS, AI_TONES, DEFAULT_MERCHANT_AI_SETTINGS } from "../merchant-ai-settings/merchant-ai-settings.types";
import type { ActivationReadinessResponseDto } from "./activation.dto";

type ActivationStore = Parameters<typeof storeInformationReady>[0] & { id: string };
const text = (value: string | null | undefined, max: number) => Boolean(value?.trim() && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value));

// Shared with onboarding: one set of domain checks, no provider calls or writes.
// Callers must resolve/authorize the merchant before entering this function.
export async function loadActivationReadiness(db: Prisma.TransactionClient, merchant: ActivationStore, hasOwner: boolean): Promise<ActivationReadinessResponseDto> {
  const merchantId = merchant.id;
  const platforms = await db.$queryRawUnsafe<Array<{ id: string }>>("SELECT id FROM platforms WHERE lower(btrim(code))='line' AND status='active'");
  const [channels, settings, productsCount, faqCount] = await Promise.all([
    platforms.length === 1 ? db.channel.findMany({ where: { merchantId, platformId: platforms[0].id,
      status: { notIn: ["DISCONNECTED", "DISABLED"] } }, take: 2,
      select: { id: true, status: true, isConnected: true, credentialRevision: true, externalChannelId: true,
        accessTokenEncrypted: true, channelSecretEncrypted: true, credentialsVerifiedAt: true,
        webhookVerifiedAt: true, lineBotUserId: true, lineClaimedAt: true } }) : Promise.resolve([]),
    db.aiSetting.findUnique({ where: { merchantId }, select: { botName: true, tone: true, language: true,
      fallbackBehavior: true, aiEnabled: true, aiActivatedAt: true } }),
    db.product.count({ where: { merchantId, status: "ACTIVE" } }),
    db.knowledgeBaseDocument.count({ where: { merchantId, type: "faq", status: "ACTIVE" } }),
  ]);
  const channel = channels.length === 1 ? channels[0] : null;
  const storeReady = storeInformationReady(merchant, hasOwner ? "Owner" : "");
  const lineReady = Boolean(["ACTIVE", "TRIAL"].includes(merchant.status) && channel && channel.status === "CONNECTED" &&
    channel.isConnected && channel.credentialRevision > 0 && channel.externalChannelId && /^\d{1,255}$/.test(channel.externalChannelId) &&
    channel.accessTokenEncrypted && channel.channelSecretEncrypted && channel.credentialsVerifiedAt && channel.webhookVerifiedAt &&
    channel.lineClaimedAt && channel.lineBotUserId && /^U[0-9a-f]{32}$/.test(channel.lineBotUserId));
  const tone = settings?.tone ?? DEFAULT_MERCHANT_AI_SETTINGS.tone;
  const fallbackBehavior = settings?.fallbackBehavior.toLowerCase() ?? "";
  const aiContextReady = Boolean(settings && text(settings.botName, 80) && ["th", "en"].includes(settings.language) &&
    AI_TONES.includes(tone as typeof AI_TONES[number]) && AI_FALLBACKS.includes(fallbackBehavior as typeof AI_FALLBACKS[number]));
  const checks = {
    store: { ready: storeReady, code: storeReady ? "STORE_READY" : "STORE_INCOMPLETE", title: "ข้อมูลร้านค้า" },
    line: { ready: lineReady, code: lineReady ? "LINE_READY" : "LINE_NOT_CONNECTED", title: "การเชื่อมต่อ LINE OA" },
    // Products/FAQ are optional. Required store data is the minimum knowledge.
    knowledge: { ready: storeReady, code: storeReady ? "KNOWLEDGE_READY" : "STORE_KNOWLEDGE_INCOMPLETE", title: "ข้อมูลสำหรับตอบลูกค้า", productsCount, faqCount },
    aiContext: { ready: aiContextReady, code: aiContextReady ? "AI_CONTEXT_READY" : "AI_CONTEXT_INCOMPLETE", title: "บริบทและกฎของ AI" },
  };
  return { merchantId, ready: Object.values(checks).every(check => check.ready),
    aiEnabled: Boolean(settings?.aiEnabled && settings.aiActivatedAt), activatedAt: settings?.aiActivatedAt?.toISOString() ?? null,
    checks, channel: { platform: "LINE", connected: lineReady, displayName: merchant.shopName, channelUuid: channel?.id ?? null },
    aiSummary: { assistantName: settings?.botName ?? "", tone, fallbackBehavior } };
}

// Trusted webhook context only. No environment or merchant-status fallback.
export async function activeAiEpoch(db: Prisma.TransactionClient, merchantId: string): Promise<string | null> {
  const row = await db.aiSetting.findFirst({ where: { merchantId, aiEnabled: true, aiActivatedAt: { not: null } }, select: { aiActivatedAt: true } });
  return row?.aiActivatedAt?.toISOString() ?? null;
}
