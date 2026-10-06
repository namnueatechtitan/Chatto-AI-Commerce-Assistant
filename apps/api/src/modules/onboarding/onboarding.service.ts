import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MerchantsService } from "../merchants.module";
import { buildOnboardingProgress } from "./onboarding-status";
import { storeInformationReady } from "../store-information/store-information.service";
import { loadActivationReadiness } from "../merchant-activation/activation-readiness";

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
    let activationComplete = false;
    let hasOwner = false;
    if (selected) {
      hasOwner = selected.role.name === "Owner" || (await this.merchants.findOwners(selected.merchant.id)).length > 0;
      storeReady = storeInformationReady(selected.merchant, hasOwner ? "Owner" : "");
    }
    if (selected && ["ACTIVE", "TRIAL"].includes(selected.merchant.status)) {
      const readiness = await loadActivationReadiness(this.prisma, selected.merchant, hasOwner);
      lineReady = readiness.checks.line.ready;
      contextReady = readiness.checks.aiContext.ready;
      // Step 6 is complete only while automatic replies are enabled.
      activationComplete = readiness.aiEnabled;
    }

    return {
      memberships, merchant: selected?.merchant ?? null, role: selected?.role.name ?? null,
      ...buildOnboardingProgress({ store: storeReady, line: lineReady, context: contextReady, activation: activationComplete }),
      capabilities: { lineSetup: true, contextSetup: true, activation: true },
    };
  }
}
