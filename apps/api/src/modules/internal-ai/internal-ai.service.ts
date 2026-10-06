import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { isUUID } from "class-validator";
import { DocumentStatus, Prisma, ProductStatus } from "@prisma/client";
import type {
  KnowledgeBaseExportResponse,
  AiConversationMessage,
  MerchantSettingsForAi,
  ProductExportResponse,
  ProductForAi,
  ProductVariantForAi,
  VectorDocumentForAi,
  VectorDocumentSyncResponse,
} from "../ai-integration/ai-contract.types";

import { PrismaService } from "../../prisma/prisma.service";
import { MerchantAiSettingsService } from "../merchant-ai-settings/merchant-ai-settings.service";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "object" && "toNumber" in value) {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function enumToApiStatus(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function availableQty(stockOnHand?: number | null, stockReserved?: number | null): number {
  return Math.max((stockOnHand ?? 0) - (stockReserved ?? 0), 0);
}

@Injectable()
export class InternalAiService {
  constructor(private readonly prisma: PrismaService, private readonly settings: MerchantAiSettingsService) {}

  private requireMerchantId(merchantId: string): void {
    if (typeof merchantId !== "string" || !isUUID(merchantId)) throw new BadRequestException("merchant_id must be a UUID");
  }

  async exportProducts(merchantId: string): Promise<ProductExportResponse> {
    this.requireMerchantId(merchantId);
    const products = await this.prisma.product.findMany({
      where: {
        merchantId,
        status: ProductStatus.ACTIVE,
      },
      include: {
        variants: {
          where: {
            merchantId,
            status: ProductStatus.ACTIVE,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        images: {
          where: { merchantId },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return {
      merchant_id: merchantId,
      products: products.map((product): ProductForAi => {
        const variants: ProductVariantForAi[] = product.variants.map((variant) => {
          const price = toNumber(variant.price);
          const stockQty = variant.stockOnHand ?? 0;
          const reservedQty = variant.stockReserved ?? 0;

          return {
            id: variant.id,
            product_id: variant.productId,
            variant_name: variant.variantName,
            sku: variant.sku ?? undefined,
            color: variant.color ?? undefined,
            size: variant.size ?? undefined,
            price,
            currency: variant.currency ?? "THB",
            stock_qty: stockQty,
            reserved_qty: reservedQty,
            available_qty: availableQty(stockQty, reservedQty),
            low_stock_threshold: variant.lowStockThreshold ?? null,
            status: enumToApiStatus(variant.status),
          };
        });

        const variantPrices = variants
          .map((variant) => variant.price)
          .filter((price): price is number => typeof price === "number");

        const productPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : null;
        const productCurrency = variants[0]?.currency ?? "THB";

        return {
          id: product.id,
          merchant_id: product.merchantId,
          name: product.name,
          description: product.description ?? null,
          category: product.category ?? null,
          brand: product.brand ?? null,
          price: productPrice,
          currency: productCurrency,
          image_urls: product.images.map((image) => image.imageUrl),
          status: enumToApiStatus(product.status),
          variants,
          updated_at: toIso(product.updatedAt),
        };
      }),
    };
  }

  async exportKnowledgeBase(merchantId: string): Promise<KnowledgeBaseExportResponse> {
    this.requireMerchantId(merchantId);
    const documents = await this.prisma.knowledgeBaseDocument.findMany({
      where: {
        merchantId,
        status: DocumentStatus.ACTIVE,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return {
      merchant_id: merchantId,
      knowledge_base: documents.map((document) => ({
        id: document.id,
        merchant_id: document.merchantId,
        type: document.type,
        title: document.title,
        content: document.content,
        status: enumToApiStatus(document.status),
        updated_at: toIso(document.updatedAt),
      })),
    };
  }

  async exportVectorDocuments(merchantId: string): Promise<VectorDocumentForAi[]> {
    this.requireMerchantId(merchantId);
    const documents = await this.prisma.vectorDocument.findMany({
      where: {
        merchantId,
        status: DocumentStatus.ACTIVE,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return documents.map((document) => ({
      id: document.id,
      merchant_id: document.merchantId,
      source_type: document.sourceType,
      source_id: document.sourceId,
      chunk_text: document.chunkText,
      embedding: Array.isArray(document.embedding)
        ? document.embedding.filter(
            (value): value is number => typeof value === "number",
          )
        : null,
      metadata:
        typeof document.metadata === "object" &&
        document.metadata !== null &&
        !Array.isArray(document.metadata)
          ? (document.metadata as Record<string, unknown>)
          : null,
      status: enumToApiStatus(document.status),
    }));
  }

  async syncVectorDocuments(
    merchantId: string,
    documents: VectorDocumentForAi[],
  ): Promise<VectorDocumentSyncResponse> {
    this.requireMerchantId(merchantId);
    if (!Array.isArray(documents) || documents.some((document) => !document || document.merchant_id !== merchantId)) {
      throw new BadRequestException("Invalid vector documents");
    }
    const managedDocuments = documents.filter(
      (document) =>
        document.id &&
        document.merchant_id === merchantId &&
        document.metadata?.managed_by === "chatto-live-chunker" &&
        Array.isArray(document.embedding) &&
        document.embedding.length > 0,
    );

    if (managedDocuments.length === 0) {
      return {
        merchant_id: merchantId,
        upserted: 0,
        deleted: 0,
      };
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${merchantId}))`;
      const merchant = await transaction.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
      if (!merchant) throw new NotFoundException("Merchant not found");
      const ids = managedDocuments.map((document) => document.id!);
      if (new Set(ids).size !== ids.length || managedDocuments.some((document) => !isUUID(document.id!) || !isUUID(document.source_id))) {
        throw new BadRequestException("Invalid vector documents");
      }
      const existing = await transaction.vectorDocument.findMany({
        where: { merchantId, id: { in: ids } },
        select: { id: true, sourceType: true, sourceId: true, metadata: true },
      });
      const owned = new Map(existing.map((document) => [document.id, document]));
      // Validate every source before writing; a client-supplied UUID is not ownership evidence.
      for (const document of managedDocuments) {
        const source = document.source_type === "product"
          ? await transaction.product.findFirst({ where: { id: document.source_id, merchantId }, select: { id: true } })
          : document.source_type === "product_variant"
            ? await transaction.productVariant.findFirst({ where: { id: document.source_id, merchantId, product: { merchantId } }, select: { id: true } })
            : await transaction.knowledgeBaseDocument.findFirst({ where: {
              id: document.source_id, merchantId,
              ...(document.source_type === "knowledge_base" ? {} : { type: document.source_type }),
            }, select: { id: true } });
        const previous = owned.get(document.id!);
        const metadata = previous?.metadata as Record<string, unknown> | null | undefined;
        if (!source || (previous && (previous.sourceType !== document.source_type || previous.sourceId !== document.source_id || metadata?.managed_by !== "chatto-live-chunker"))) {
          throw new BadRequestException("Invalid vector documents");
        }
      }
      for (const document of managedDocuments) {
        const data = {
          chunkText: document.chunk_text, embedding: document.embedding as Prisma.InputJsonValue,
          metadata: (document.metadata ?? {}) as Prisma.InputJsonValue, status: DocumentStatus.ACTIVE,
        };
        if (owned.has(document.id!)) {
          const updated = await transaction.vectorDocument.updateMany({
            where: { id: document.id!, merchantId, sourceType: document.source_type, sourceId: document.source_id }, data,
          });
          if (updated.count !== 1) throw new BadRequestException("Invalid vector documents");
        } else {
          // Foreign globally unique IDs cause a conflict, never a tenant reassignment.
          await transaction.vectorDocument.create({ data: {
            ...data, id: document.id!, merchantId, sourceType: document.source_type, sourceId: document.source_id,
          } });
        }
      }

      const sourceGroups = new Map<string, typeof managedDocuments>();

      for (const document of managedDocuments) {
        const key = `${document.source_type}:${document.source_id}`;
        const group = sourceGroups.get(key) ?? [];
        group.push(document);
        sourceGroups.set(key, group);
      }

      let deleted = 0;

      for (const group of sourceGroups.values()) {
        const first = group[0];
        const stale = await transaction.vectorDocument.deleteMany({
          where: {
            merchantId,
            sourceType: first.source_type,
            sourceId: first.source_id,
            id: {
              notIn: group
                .map((document) => document.id)
                .filter((id): id is string => Boolean(id)),
            },
            metadata: {
              path: ["managed_by"],
              equals: "chatto-live-chunker",
            },
          },
        });
        deleted += stale.count;
      }

      return deleted;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Invalid vector documents");
      }
      throw error;
    });

    return {
      merchant_id: merchantId,
      upserted: managedDocuments.length,
      deleted: result,
    };
  }

  async exportConversationHistory(
    merchantId: string,
    conversationId: string,
    excludeMessageId?: string,
  ): Promise<AiConversationMessage[]> {
    this.requireMerchantId(merchantId);
    if (!isUUID(conversationId) || (excludeMessageId !== undefined && !isUUID(excludeMessageId))) {
      throw new BadRequestException("Invalid conversation reference");
    }
    const messages = await this.prisma.message.findMany({
      where: {
        merchantId,
        conversationId,
        conversation: { merchantId, customer: { merchantId }, channel: { merchantId } },
        ...(excludeMessageId ? { id: { not: excludeMessageId } } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
      select: {
        senderType: true,
        content: true,
        createdAt: true,
      },
    });

    return messages.reverse().map((message) => ({
      sender_type: message.senderType.toLowerCase(),
      content: message.content,
      created_at: message.createdAt.toISOString(),
    }));
  }

  async exportMerchantSettings(merchantId: string): Promise<MerchantSettingsForAi> {
    this.requireMerchantId(merchantId);
    const merchant = await this.prisma.merchant.findUnique({
      where: {
        id: merchantId,
      },
    });

    if (!merchant) {
      throw new NotFoundException("Merchant not found");
    }

    const settings = await this.settings.getSettingsForMerchant(merchantId);

    return {
      merchant_id: merchantId,
      store_name: merchant.shopName,
      bot_name: settings.assistantName,
      default_language: settings.language,
      ai_tone: settings.tone,
      rules: settings.rules.map(rule => rule.text),
      ai_profile: settings,
      enabled_features: {
        product_qa: true,
        recommendation: settings.capabilities.recommendProducts,
        checkout: false,
        memory: settings.capabilities.rememberCustomerInterest,
        human_handover: false,
      },
    };
  }
}
