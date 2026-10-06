import { BadRequestException, HttpException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AiFallbackBehavior, AiResponseLength, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StoreInformationService } from "../store-information/store-information.service";
import { UpdateMerchantAiSettingsDto } from "./merchant-ai-settings.dto";
import { AI_TONES, DEFAULT_MERCHANT_AI_SETTINGS, MerchantAiSettings } from "./merchant-ai-settings.types";

const lengthToDb = { short: AiResponseLength.SHORT, medium: AiResponseLength.MEDIUM, detailed: AiResponseLength.DETAILED };
const fallbackToDb = { notify_and_handoff: AiFallbackBehavior.NOTIFY_AND_HANDOFF, handoff_immediately: AiFallbackBehavior.HANDOFF_IMMEDIATELY, general_knowledge: AiFallbackBehavior.GENERAL_KNOWLEDGE };

@Injectable()
export class MerchantAiSettingsService {
  constructor(private readonly prisma: PrismaService, private readonly ownership: StoreInformationService) {}

  // Internal callers pass a merchant resolved from trusted channel/session context.
  // External requests use read/update below, which authorize inside the transaction.
  async getSettingsForMerchant(merchantId: string, db: Prisma.TransactionClient = this.prisma): Promise<MerchantAiSettings> {
    const row = await db.aiSetting.findUnique({ where: { merchantId }, include: {
      rules: { where: { isEnabled: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    } });
    const defaults = DEFAULT_MERCHANT_AI_SETTINGS;
    if (!row) return { ...defaults, capabilities: { ...defaults.capabilities }, rules: [] };
    // Keep legacy JSON intact until an explicit save adopts normalized rules.
    const legacyValues = Array.isArray(row.storeRules) ? row.storeRules : row.storeRules && typeof row.storeRules === "object"
      ? Object.values(row.storeRules).flatMap(value => Array.isArray(value) ? value : [value]) : [row.storeRules];
    const legacyRules = legacyValues.filter((text): text is string => typeof text === "string" && !!text.trim());
    return {
      assistantName: row.botName, pronoun: row.pronoun ?? defaults.pronoun,
      tone: AI_TONES.includes(row.tone as MerchantAiSettings["tone"]) ? row.tone as MerchantAiSettings["tone"] : defaults.tone,
      language: row.language === "th" || row.language === "en" ? row.language : defaults.language,
      useEmoji: row.useEmoji, responseLength: row.responseLength.toLowerCase() as MerchantAiSettings["responseLength"],
      capabilities: { recommendProducts: row.recommendProducts, checkStock: row.checkStock, compareProducts: row.compareProducts,
        answerFaq: row.answerFaq, showPrices: row.showPrices, rememberCustomerInterest: row.memoryEnabled ?? defaults.capabilities.rememberCustomerInterest,
        showPromotions: row.showPromotions, recommendRelatedProducts: row.recommendRelatedProducts },
      rules: row.rulesConfigured ? row.rules.map(({ id, text, sortOrder }) => ({ id, text, sortOrder }))
        : legacyRules.map((text, sortOrder) => ({ text, sortOrder })),
      fallbackBehavior: row.fallbackBehavior.toLowerCase() as MerchantAiSettings["fallbackBehavior"],
    };
  }

  private async sanitized<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error) {
      if (error instanceof HttpException) throw error;
      // Avoid Nest's default exception logger printing Prisma arguments/custom rules.
      throw new ServiceUnavailableException("AI settings are temporarily unavailable");
    }
  }
  read(userId: string, merchantId: string) {
    return this.sanitized(() => this.prisma.$transaction(async tx => {
      const membership = await this.ownership.authorize(userId, merchantId, false, tx);
      return { ...await this.getSettingsForMerchant(merchantId, tx), canEdit: membership.role.name === "Owner" && ["ACTIVE", "TRIAL"].includes(membership.merchant.status) };
    }, { isolationLevel: "RepeatableRead" }));
  }
  update(userId: string, merchantId: string, input: UpdateMerchantAiSettingsDto) {
    return this.sanitized(() => this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${merchantId}))`;
      await this.ownership.authorize(userId, merchantId, true, tx);
      const current = await tx.aiSetting.findUnique({ where: { merchantId }, select: { id: true } });
      const ids = (input.rules ?? []).flatMap(rule => rule.id ? [rule.id] : []);
      if (new Set(ids).size !== ids.length) throw new BadRequestException("Duplicate AI rule IDs");
      if (ids.length) {
        const owned = current ? await tx.merchantAiRule.count({ where: { aiSettingsId: current.id, id: { in: ids } } }) : 0;
        if (owned !== ids.length) throw new BadRequestException("AI rule does not belong to this store");
      }
      const defaults = DEFAULT_MERCHANT_AI_SETTINGS;
      const capabilities = input.capabilities;
      const capabilityData = capabilities ? { recommendProducts: capabilities.recommendProducts, checkStock: capabilities.checkStock,
        compareProducts: capabilities.compareProducts, answerFaq: capabilities.answerFaq, showPrices: capabilities.showPrices,
        memoryEnabled: capabilities.rememberCustomerInterest, showPromotions: capabilities.showPromotions,
        recommendRelatedProducts: capabilities.recommendRelatedProducts } : {};
      const data: Prisma.AiSettingUpdateInput = {
        botName: input.assistantName, pronoun: input.pronoun, tone: input.tone, language: input.language,
        useEmoji: input.useEmoji, responseLength: input.responseLength === undefined ? undefined : lengthToDb[input.responseLength],
        fallbackBehavior: input.fallbackBehavior === undefined ? undefined : fallbackToDb[input.fallbackBehavior],
        ...capabilityData,
      };
      const row = await tx.aiSetting.upsert({ where: { merchantId },
        create: { merchantId, botName: input.assistantName ?? defaults.assistantName, pronoun: input.pronoun ?? defaults.pronoun,
          tone: input.tone ?? defaults.tone, language: input.language ?? defaults.language,
          useEmoji: input.useEmoji ?? defaults.useEmoji, responseLength: lengthToDb[input.responseLength ?? defaults.responseLength],
          fallbackBehavior: fallbackToDb[input.fallbackBehavior ?? defaults.fallbackBehavior],
          ...capabilityData }, update: data,
      });
      if (input.rules !== undefined) {
        await tx.merchantAiRule.deleteMany({ where: { aiSettingsId: row.id, id: { notIn: ids } } });
        for (const [sortOrder, rule] of input.rules.entries()) {
          if (rule.id) await tx.merchantAiRule.update({ where: { id: rule.id, aiSettingsId: row.id }, data: { text: rule.text, sortOrder, isEnabled: true } });
          else await tx.merchantAiRule.create({ data: { aiSettingsId: row.id, text: rule.text, sortOrder } });
        }
        await tx.aiSetting.update({ where: { id: row.id, merchantId }, data: { rulesConfigured: true } });
      }
      return { ...await this.getSettingsForMerchant(merchantId, tx), canEdit: true };
    }));
  }
}
