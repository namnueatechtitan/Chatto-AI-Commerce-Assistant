import { Injectable, NotFoundException } from "@nestjs/common";
import { AiActionStatus, ConversationStatus, GuardrailSeverity, Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AiChatRequest, AiChatResponse } from "./ai-contract.types";

@Injectable()
export class AiSafetyService {
  constructor(private readonly prisma: PrismaService) {}

  async isAiActive(request: AiChatRequest): Promise<boolean> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: request.conversation_id, merchantId: request.merchant_id, customerId: request.customer.id },
      select: { status: true },
    });
    if (!conversation) throw new NotFoundException("Conversation not found in merchant/customer scope");
    return conversation.status === ConversationStatus.AI_ACTIVE;
  }

  /** Atomically audit, create one open ticket, and stop AI for this conversation. */
  async record(request: AiChatRequest, response: AiChatResponse): Promise<boolean> {
    return this.prisma.$transaction(async transaction => {
      // Serialize decisions across API processes, not just within this JS instance.
      const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM conversations
        WHERE id = ${request.conversation_id}::uuid
          AND merchant_id = ${request.merchant_id}::uuid
          AND customer_id = ${request.customer.id}::uuid
        FOR UPDATE
      `);
      if (!rows.length) throw new NotFoundException("Conversation not found in merchant/customer scope");
      const existing = await transaction.aiActionLog.findFirst({
        where: { merchantId: request.merchant_id, conversationId: request.conversation_id,
          actionType: "ai_reply_decision", inputJson: { path: ["request_id"], equals: request.request_id } },
        select: { id: true },
      });
      if (existing) return false;
      const conversation = await transaction.conversation.findUniqueOrThrow({ where: { id: request.conversation_id } });
      if (conversation.status !== ConversationStatus.AI_ACTIVE) return false;
      const checks = response.guardrails ?? [];
      const blocked = checks.some(check => !check.allowed);
      const reason = response.handover_reason ?? "LOW_CONFIDENCE";
      const scope = { merchantId: request.merchant_id, conversationId: request.conversation_id, customerId: request.customer.id };
      await transaction.aiActionLog.create({ data: {
        ...scope, actionType: "ai_reply_decision",
        status: blocked ? AiActionStatus.REJECTED : response.handover_required ? AiActionStatus.HUMAN_REVIEW_REQUIRED : AiActionStatus.VALIDATED,
        confidence: response.reply.confidence,
        inputJson: { request_id: request.request_id, message_id: request.message.id },
        outputJson: json({ handover_required: response.handover_required, confidence: response.confidence, sources: response.sources ?? [] }),
        validationResult: json(checks), reason: response.handover_required ? reason : null,
      } });
      for (const check of checks.filter(check => check.reasons.length > 0)) {
        await transaction.guardrailEvent.create({ data: {
          ...scope, eventType: `${check.stage}_guardrail`,
          severity: check.severity === "high" ? GuardrailSeverity.HIGH : check.severity === "medium" ? GuardrailSeverity.MEDIUM : GuardrailSeverity.LOW,
          blockedAction: check.allowed ? null : "ai_reply",
          description: check.reasons.join(", "),
          // Deliberately omit raw input and rejected model text from safety logs.
        } });
      }
      if (response.handover_required) {
        const ticket = await transaction.handoverTicket.findFirst({ where: {
          ...scope, status: { in: [TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
        } });
        if (!ticket) await transaction.handoverTicket.create({ data: {
          ...scope, reason: reason.slice(0, 100),
          priority: blocked ? TicketPriority.HIGH : TicketPriority.MEDIUM,
          status: TicketStatus.OPEN,
          aiSummary: `AI review required: ${reason}; evidence score=${response.reply.confidence}`,
        } });
        await transaction.conversation.update({ where: { id: request.conversation_id }, data: {
          status: ConversationStatus.HANDOVER_REQUESTED, ownerType: "human",
        } });
      }
      return true;
    });
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
