import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { MerchantsService } from "../merchants.module";
import { CreateOnboardingStoreDto, FaqDto, StoreInformationDto, UpdateStoreInformationDto } from "./store-information.dto";

export const informationSelect = {
  id: true, shopName: true, businessCategory: true, operatingHours: true, description: true,
  phone: true, email: true, address: true, informationRevision: true, status: true,
} as const;
export function storeInformationReady(store: { shopName: string; businessCategory: string | null; operatingHours: string | null; status: string }, role: string): boolean {
  return role === "Owner" && ["ACTIVE", "TRIAL"].includes(store.status) &&
    Boolean(store.shopName.trim() && store.businessCategory?.trim() && store.operatingHours?.trim()) &&
    store.shopName.length <= 255 && (store.businessCategory?.length ?? 0) <= 255 &&
    (store.operatingHours?.length ?? 0) <= 255 && !/[\x00-\x1f\x7f]/.test(store.operatingHours ?? "");
}
@Injectable()
export class StoreInformationService {
  constructor(private readonly prisma: PrismaService, private readonly merchants: MerchantsService) {}
  async authorize(userId: string, merchantId: string, write = false, db: Prisma.TransactionClient = this.prisma) {
    const membership = await db.merchantUser.findUnique({
      where: { merchantId_userId: { merchantId, userId } },
      select: { status: true, role: { select: { name: true } }, merchant: { select: { status: true } } },
    });
    if (!membership || membership.status !== "ACTIVE") throw new NotFoundException("Merchant not found");
    if (write && (membership.role.name !== "Owner" || !["ACTIVE", "TRIAL"].includes(membership.merchant.status))) throw new ForbiddenException("Only an active store Owner can edit this store");
    return membership;
  }
  private async readInTransaction(db: Prisma.TransactionClient, merchantId: string) {
    const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId }, select: informationSelect });
    const documents = await db.knowledgeBaseDocument.findMany({
      where: { merchantId, type: "faq", status: "ACTIVE" }, select: { id: true, title: true, content: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return { merchant, faqs: documents.map(({ id, title, content }) => ({ id, question: title, answer: content })) };
  }
  read(userId: string, merchantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.authorize(userId, merchantId, false, tx);
      return { ...await this.readInTransaction(tx, merchantId), canEdit: membership.role.name === "Owner" && ["ACTIVE", "TRIAL"].includes(membership.merchant.status) };
    }, { isolationLevel: "RepeatableRead" });
  }
  private data(input: StoreInformationDto) {
    return { shopName: input.shopName, businessCategory: input.businessCategory, operatingHours: input.operatingHours,
      description: input.description || null, phone: input.phone || null, email: input.email || null, address: input.address || null };
  }
  private async saveFaqs(tx: Prisma.TransactionClient, merchantId: string, faqs?: FaqDto[]) {
    if (faqs === undefined) return;
    const ids = faqs.flatMap((faq) => faq.id ? [faq.id] : []);
    if (new Set(ids).size !== ids.length) throw new BadRequestException("Duplicate FAQ IDs");
    const existing = await tx.knowledgeBaseDocument.findMany({ where: { id: { in: ids }, merchantId, type: "faq" }, select: { id: true } });
    if (existing.length !== ids.length) throw new BadRequestException("FAQ does not belong to this store");
    await tx.knowledgeBaseDocument.updateMany({ where: { merchantId, type: "faq", status: "ACTIVE", id: { notIn: ids } }, data: { status: "ARCHIVED" } });
    for (const faq of faqs) {
      const data = { title: faq.question, content: faq.answer, status: "ACTIVE" as const };
      if (faq.id) await tx.knowledgeBaseDocument.update({ where: { id: faq.id }, data });
      else await tx.knowledgeBaseDocument.create({ data: { ...data, merchantId, type: "faq" } });
    }
  }
  create(userId: string, input: CreateOnboardingStoreDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const retry = await tx.merchant.findUnique({ where: { onboardingRequestId: input.requestId }, select: { id: true } });
      if (retry) {
        await this.authorize(userId, retry.id, true, tx);
        return { ...await this.readInTransaction(tx, retry.id), canEdit: true };
      }
      if (await tx.merchantUser.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } })) throw new ConflictException("A store already exists. Reload and select the store to edit.");
      const merchant = await this.merchants.createWithTransaction(tx, userId, input.shopName, { ...this.data(input), onboardingRequestId: input.requestId, informationRevision: 1 });
      await this.saveFaqs(tx, merchant.id, input.faqs);
      return { ...await this.readInTransaction(tx, merchant.id), canEdit: true };
    });
  }
  update(userId: string, merchantId: string, input: UpdateStoreInformationDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${merchantId}))`;
      await this.authorize(userId, merchantId, true, tx);
      const result = await tx.merchant.updateMany({ where: { id: merchantId, informationRevision: input.revision }, data: { ...this.data(input), informationRevision: { increment: 1 } } });
      if (result.count !== 1) throw new ConflictException("Store information changed. Reload before saving again.");
      await this.saveFaqs(tx, merchantId, input.faqs);
      return { ...await this.readInTransaction(tx, merchantId), canEdit: true };
    });
  }
}
