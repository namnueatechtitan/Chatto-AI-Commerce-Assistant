import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StoreInformationService, informationSelect } from "../store-information/store-information.service";
import { loadActivationReadiness } from "./activation-readiness";
import type { ActivationReadinessResponseDto, ActivationResponseDto } from "./activation.dto";

@Injectable()
export class MerchantActivationService {
  constructor(private readonly prisma: PrismaService, private readonly ownership: StoreInformationService) {}
  private async safe<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
        throw new ConflictException("Activation state changed; refresh and retry");
      throw new ServiceUnavailableException("AI activation is temporarily unavailable");
    }
  }
  private async readinessIn(db: Prisma.TransactionClient, merchantId: string) {
    const merchant = await db.merchant.findUnique({ where: { id: merchantId }, select: informationSelect });
    if (!merchant) throw new NotFoundException("Merchant not found");
    const owner = await db.merchantUser.findFirst({ where: { merchantId, status: "ACTIVE", role: { name: "Owner" }, user: { status: "ACTIVE" } }, select: { id: true } });
    return loadActivationReadiness(db, merchant, !!owner);
  }
  readiness(userId: string, merchantId: string): Promise<ActivationReadinessResponseDto> {
    return this.safe(() => this.prisma.$transaction(async db => {
      await this.ownership.authorize(userId, merchantId, false, db);
      return this.readinessIn(db, merchantId);
    }, { isolationLevel: "RepeatableRead" }));
  }
  private async writeAccess(db: Prisma.TransactionClient, userId: string, merchantId: string) {
    // Same order as LINE runtime/mutations. Step 3/5 saves use the second lock.
    // Pause waits for an already-started outbound provider transaction to finish.
    await db.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", "merchant-line:" + merchantId);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${merchantId}))`;
    const membership = await db.$queryRawUnsafe<Array<{ id: string }>>(
      "SELECT mu.id FROM merchant_users mu JOIN merchants m ON m.id=mu.merchant_id JOIN roles r ON r.id=mu.role_id JOIN users u ON u.id=mu.user_id WHERE mu.merchant_id=$1::uuid AND mu.user_id=$2::uuid AND u.status='active' FOR SHARE OF mu,m,r,u", merchantId, userId);
    if (membership.length !== 1) throw new NotFoundException("Merchant not found");
    await this.ownership.authorize(userId, merchantId, true, db);
  }
  activate(userId: string, merchantId: string): Promise<ActivationResponseDto> {
    return this.safe(() => this.prisma.$transaction(async db => {
      await this.writeAccess(db, userId, merchantId);
      const readiness = await this.readinessIn(db, merchantId);
      // Always revalidate even an already-enabled request; client values are ignored.
      if (!readiness.ready) throw new ConflictException({ code: "MERCHANT_NOT_READY", message: "Merchant is not ready for AI activation.", checks: readiness.checks });
      if (readiness.aiEnabled) return { success: true, aiEnabled: true, alreadyEnabled: true, activatedAt: readiness.activatedAt };
      // Monotonic activation epoch also invalidates work from before a pause,
      // even if the merchant resumes before an old LLM request finishes.
      const now = new Date(Math.max(Date.now(), readiness.activatedAt ? Date.parse(readiness.activatedAt) + 1 : 0));
      await db.aiSetting.update({ where: { merchantId }, data: { aiEnabled: true, aiActivatedAt: now, aiActivatedByUserId: userId } });
      await db.aiActionLog.create({ data: { merchantId, actionType: "AI_ACTIVATED", status: "EXECUTED", inputJson: { actorUserId: userId, timestamp: now.toISOString() } } });
      return { success: true, aiEnabled: true, alreadyEnabled: false, activatedAt: now.toISOString() };
    }, { timeout: 12000, maxWait: 12000 }));
  }
  deactivate(userId: string, merchantId: string): Promise<ActivationResponseDto> {
    return this.safe(() => this.prisma.$transaction(async db => {
      await this.writeAccess(db, userId, merchantId);
      const row = await db.aiSetting.findUnique({ where: { merchantId }, select: { aiEnabled: true, aiActivatedAt: true } });
      if (!row?.aiEnabled) return { success: true, aiEnabled: false, alreadyDisabled: true, activatedAt: row?.aiActivatedAt?.toISOString() ?? null };
      await db.aiSetting.update({ where: { merchantId }, data: { aiEnabled: false } });
      await db.aiActionLog.create({ data: { merchantId, actionType: "AI_DEACTIVATED", status: "EXECUTED", inputJson: { actorUserId: userId, timestamp: new Date().toISOString() } } });
      return { success: true, aiEnabled: false, alreadyDisabled: false, activatedAt: row.aiActivatedAt?.toISOString() ?? null };
    }, { timeout: 12000, maxWait: 12000 }));
  }
}
