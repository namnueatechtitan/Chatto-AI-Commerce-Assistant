import { BadRequestException, HttpException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AiIntegrationService } from "../ai-integration/ai-integration.service";
import type { AiChatResponse } from "../ai-integration/ai-contract.types";
import { buildAiChatRequest } from "../ai-integration/ai-chat-request.mapper";
import { LineProviderAdapter } from "../merchant-line/line-provider.adapter";
import { LineChannelRuntimeService, TrustedLineChannel } from "./line-channel-runtime.service";
import { activeAiEpoch } from "../merchant-activation/activation-readiness";
import type { LineWebhookEvent, LineWebhookHandleResult, LineWebhookTextMessageEvent } from "./types/line-webhook.types";

interface LineJob extends TrustedLineChannel {
  eventId: string;
  customerId: string;
  conversationId: string;
  messageId: string;
  activationEpoch: string;
}

// Qualify provider IDs by channel in the existing global unique column.
export function scopedLineEventId(channelId: string, event: LineWebhookEvent): string {
  const identity = event.webhookEventId || JSON.stringify({ type: event.type, timestamp: event.timestamp,
    source: event.source, messageId: "message" in event ? (event.message as { id?: string })?.id : undefined });
  return "line_" + createHash("sha256").update(JSON.stringify([channelId.toLowerCase(), identity])).digest("hex");
}

@Injectable()
export class LineWebhooksService {
  constructor(private readonly prisma: PrismaService, private readonly runtime: LineChannelRuntimeService,
    private readonly ai: AiIntegrationService, private readonly provider: LineProviderAdapter) {}

  // Retire the global-secret/default-merchant route; preserve historical rows.
  async handleWebhook(..._legacy: unknown[]): Promise<LineWebhookHandleResult> {
    throw new ServiceUnavailableException("Use the verified channel-specific LINE webhook URL");
  }

  async receive(channelId: string, signature: string | undefined, rawBody: Buffer | undefined): Promise<LineWebhookHandleResult> {
    try { return await this.receiveVerified(channelId, signature, rawBody); }
    catch (error) {
      if (error instanceof HttpException) throw error;
      // Nest's default 500 logger can print Prisma argument dumps containing text.
      throw new ServiceUnavailableException("LINE processing is temporarily unavailable");
    }
  }

  private async receiveVerified(channelId: string, signature: string | undefined, rawBody: Buffer | undefined): Promise<LineWebhookHandleResult> {
    const authenticated = await this.runtime.authenticate(channelId, signature, rawBody);
    let body: { events: LineWebhookEvent[]; destination?: string };
    try { body = JSON.parse(rawBody!.toString("utf8")) as typeof body; }
    catch { throw new BadRequestException("Invalid LINE webhook payload"); }
    if (!body || !Array.isArray(body.events) || body.events.length > 100 || body.events.some(event => !this.validEvent(event)))
      throw new BadRequestException("Invalid LINE webhook payload");
    // Includes LINE Console's signed events:[] readiness probe.
    const context = await this.runtime.accept(authenticated, body.destination);
    const result: LineWebhookHandleResult = { ok: true, receivedEvents: body.events.length,
      processedEvents: 0, ignoredEvents: 0, duplicateEvents: 0 };
    for (const event of body.events) {
      const outcome = await this.ingest(context, event);
      if (outcome === "duplicate") result.duplicateEvents++;
      else if (!outcome) result.ignoredEvents++;
      else {
        result.processedEvents++;
        // Await bounded AI I/O instead of leaving an untracked background task.
        await this.respond(outcome, event as LineWebhookTextMessageEvent);
      }
    }
    return result;
  }

  private validEvent(event: LineWebhookEvent): boolean {
    return Boolean(event && typeof event === "object" && typeof event.type === "string" && event.type.length <= 100 &&
      Number.isFinite(event.timestamp) && event.timestamp >= 0 && event.timestamp <= 8640000000000000 &&
      event.source && typeof event.source.type === "string" &&
      (event.webhookEventId === undefined || typeof event.webhookEventId === "string" && event.webhookEventId.length > 0 && event.webhookEventId.length <= 255));
  }

  private textEvent(event: LineWebhookEvent): event is LineWebhookTextMessageEvent {
    if (event.type !== "message" || event.source.type !== "user") return false;
    const message = event.message as { type?: unknown; id?: unknown; text?: unknown } | undefined;
    return Boolean(message?.type === "text" && typeof message.id === "string" && message.id.length > 0 && message.id.length <= 255 &&
      typeof message.text === "string" && message.text.length <= 10000 && typeof event.replyToken === "string" &&
      event.replyToken.length > 0 && event.replyToken.length <= 255 && typeof event.source.userId === "string" &&
      event.source.userId.length > 0 && event.source.userId.length <= 255 && event.mode !== "standby");
  }

  private async ingest(context: TrustedLineChannel, event: LineWebhookEvent): Promise<LineJob | "duplicate" | null> {
    const eventId = scopedLineEventId(context.channelId, event);
    return this.runtime.locked(context, async db => {
      const previous = await db.lineWebhookEvent.findUnique({ where: { webhookEventId: eventId } });
      if (previous) {
        if (previous.merchantId !== context.merchantId || previous.channelId !== context.channelId)
          throw new BadRequestException("Invalid LINE event relationship");
        await db.lineWebhookEvent.updateMany({ where: { id: previous.id, merchantId: context.merchantId, channelId: context.channelId }, data: { isDuplicate: true } });
        return "duplicate";
      }
      await db.lineWebhookEvent.create({ data: { merchantId: context.merchantId, channelId: context.channelId,
        webhookEventId: eventId, eventType: event.type,
        rawPayload: { version: 1, revision: context.revision, phase: "received" } } });
      if (!this.textEvent(event)) {
        await db.lineWebhookEvent.update({ where: { webhookEventId: eventId, merchantId: context.merchantId },
          data: { processedAt: new Date(), rawPayload: { version: 1, revision: context.revision, phase: "ignored" } } });
        return null;
      }
      let customer = await db.customer.findUnique({ where: { channelId_externalUserId: {
        channelId: context.channelId, externalUserId: event.source.userId } } });
      if (customer && customer.merchantId !== context.merchantId) throw new BadRequestException("Invalid LINE channel relationships");
      customer ??= await db.customer.create({ data: { merchantId: context.merchantId, channelId: context.channelId, externalUserId: event.source.userId } });
      let conversation = await db.conversation.findFirst({ where: { merchantId: context.merchantId, customerId: customer.id,
        channelId: context.channelId, status: { in: ["AI_ACTIVE", "HANDOVER_REQUESTED", "HUMAN_ACTIVE"] },
        customer: { merchantId: context.merchantId }, channel: { merchantId: context.merchantId } }, orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }] });
      conversation ??= await db.conversation.create({ data: { merchantId: context.merchantId, customerId: customer.id,
        channelId: context.channelId, status: "AI_ACTIVE", lastMessageAt: new Date(event.timestamp) } });
      const existingMessage = await db.message.findFirst({ where: { merchantId: context.merchantId,
        externalMessageId: event.message.id, senderType: "CUSTOMER", conversation: { merchantId: context.merchantId, channelId: context.channelId } }, select: { id: true } });
      if (existingMessage) {
        await db.lineWebhookEvent.update({ where: { webhookEventId: eventId, merchantId: context.merchantId },
          data: { isDuplicate: true, processedAt: new Date(), rawPayload: { version: 1, revision: context.revision, phase: "duplicate_message" } } });
        return "duplicate";
      }
      const message = await db.message.create({ data: { merchantId: context.merchantId, conversationId: conversation.id,
        senderType: "CUSTOMER", messageType: "TEXT", content: event.message.text, externalMessageId: event.message.id,
        metadata: { line: { sourceWebhookEventId: eventId } } } });
      await db.conversation.update({ where: { id: conversation.id, merchantId: context.merchantId }, data: { lastMessageAt: new Date(event.timestamp) } });
      if (customer.isBlocked || conversation.status !== "AI_ACTIVE") {
        await db.lineWebhookEvent.update({ where: { webhookEventId: eventId, merchantId: context.merchantId },
          data: { processedAt: new Date(), rawPayload: { version: 1, revision: context.revision, phase: "human_or_blocked" } } });
        return null;
      }
      const activationEpoch = await activeAiEpoch(db, context.merchantId);
      if (!activationEpoch) {
        await this.markAiDisabled(db, context, eventId);
        return null;
      }
      return { ...context, eventId, customerId: customer.id, conversationId: conversation.id, messageId: message.id, activationEpoch };
    });
  }

  private async ownedJob(db: Prisma.TransactionClient, job: LineJob) {
    const event = await db.lineWebhookEvent.findFirst({ where: { webhookEventId: job.eventId, merchantId: job.merchantId, channelId: job.channelId } });
    const message = await db.message.findFirst({ where: { id: job.messageId, merchantId: job.merchantId, conversationId: job.conversationId,
      senderType: "CUSTOMER", conversation: { merchantId: job.merchantId, channelId: job.channelId, customerId: job.customerId,
        status: "AI_ACTIVE", customer: { merchantId: job.merchantId, channelId: job.channelId, isBlocked: false }, channel: { merchantId: job.merchantId } } } });
    const metadata = message?.metadata as { line?: { sourceWebhookEventId?: unknown } } | null;
    if (!event || !message || metadata?.line?.sourceWebhookEventId !== job.eventId ||
      (event.rawPayload as { revision?: unknown })?.revision !== job.revision)
      throw new BadRequestException("Invalid LINE processing context");
    return { event, message };
  }

  private generationMetadata(generation: AiChatResponse["generation"]): Prisma.InputJsonObject | null {
    if (!generation || !["mock", "gemini", "openai", "policy"].includes(generation.provider) ||
      typeof generation.used_external_provider !== "boolean" || typeof generation.fallback_used !== "boolean") return null;
    const modelPattern = generation.provider === "gemini" ? /^gemini-[a-zA-Z0-9._-]{1,100}$/
      : generation.provider === "openai" ? /^(?:gpt-|chatgpt-|o[1-9])[a-zA-Z0-9._-]{1,100}$/ : null;
    const result: Record<string, Prisma.InputJsonValue | null> = { provider: generation.provider,
      model: typeof generation.model === "string" && modelPattern?.test(generation.model) ? generation.model : null,
      used_external_provider: generation.used_external_provider, fallback_used: generation.fallback_used };
    const categories = ["not_configured", "timeout", "authentication", "rate_limit", "http_error",
      "empty_output", "invalid_response", "network_error", "merchant_policy", "provider_disabled", "deadline_exceeded", "cancelled"];
    for (const field of ["error_category", "fallback_reason"] as const) {
      const value = generation[field];
      if (typeof value === "string" && categories.includes(value)) result[field] = value;
    }
    for (const field of ["provider_request_attempted", "provider_success", "timed_out"] as const) {
      if (typeof generation[field] === "boolean") result[field] = generation[field];
    }
    const integer = (value: unknown, maximum: number): value is number =>
      typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum;
    if (integer(generation.latency_ms, 3_600_000)) result.latency_ms = generation.latency_ms;
    for (const field of ["pipeline_latency_ms", "context_export_ms"] as const)
      if (integer(generation[field], 3_600_000)) result[field] = generation[field]!;
    if (generation.stage_timings && typeof generation.stage_timings === "object") {
      const timings: Record<string, Prisma.InputJsonValue> = {};
      for (const stage of ["document_embedding", "query_embedding", "vector_sync", "retrieval", "generation"] as const) {
        const value = generation.stage_timings[stage];
        if (value && integer(value.latency_ms, 3_600_000) &&
          ["completed", "skipped", "timed_out", "cancelled", "failed"].includes(value.outcome))
          timings[stage] = { latency_ms: value.latency_ms, outcome: value.outcome };
      }
      result.stage_timings = timings;
    }
    if (integer(generation.retrieved_chunk_count, 100)) result.retrieved_chunk_count = generation.retrieved_chunk_count;
    if (integer(generation.provider_http_status, 599) && generation.provider_http_status >= 100)
      result.provider_http_status = generation.provider_http_status;
    if (["merchant_policy", "trusted_catalog", "deterministic", "none"].includes(generation.fallback_source ?? ""))
      result.fallback_source = generation.fallback_source!;
    return result;
  }

  private markAiDisabled(db: Prisma.TransactionClient, context: TrustedLineChannel, eventId: string) {
    return db.lineWebhookEvent.update({ where: { webhookEventId: eventId, merchantId: context.merchantId, channelId: context.channelId },
      data: { processedAt: new Date(), rawPayload: { version: 1, revision: context.revision, phase: "ai_disabled" } } });
  }

  private async respond(job: LineJob, input: LineWebhookTextMessageEvent): Promise<void> {
    try {
      const claimed = await this.runtime.locked(job, async db => {
        const { event, message } = await this.ownedJob(db, job);
        if ((event.rawPayload as { phase?: unknown }).phase !== "received") return null;
        if (await activeAiEpoch(db, job.merchantId) !== job.activationEpoch) {
          await this.markAiDisabled(db, job, job.eventId);
          return null;
        }
        await db.lineWebhookEvent.update({ where: { id: event.id, merchantId: job.merchantId },
          data: { rawPayload: { version: 1, revision: job.revision, phase: "ai_started" } } });
        return message;
      });
      if (!claimed) return;
      const response = await this.ai.chat(buildAiChatRequest({ requestId: job.eventId, merchantId: job.merchantId,
        channel: "line", conversationId: job.conversationId, customerId: job.customerId, messageId: job.messageId,
        messageText: claimed.content, timestamp: new Date(input.timestamp).toISOString() }));
      if (response.merchant_id !== job.merchantId || response.conversation_id !== job.conversationId ||
        response.request_id !== job.eventId || typeof response.reply?.text !== "string" || !response.reply.text.trim())
        throw new BadRequestException("Invalid AI response identity");
      const lineMetadata = { sourceWebhookEventId: job.eventId, channelId: job.channelId, credentialRevision: job.revision };
      const aiMetadata = { requestId: response.request_id, generation: this.generationMetadata(response.generation) };
      const outbound = await this.runtime.locked(job, async db => {
        await this.ownedJob(db, job);
        // Pause during an in-flight LLM call suppresses both reservation and delivery.
        if (await activeAiEpoch(db, job.merchantId) !== job.activationEpoch) {
          await this.markAiDisabled(db, job, job.eventId);
          return null;
        }
        const message = await db.message.create({ data: { merchantId: job.merchantId, conversationId: job.conversationId,
          senderType: "AI", messageType: "TEXT", content: response.reply.text.slice(0, 5000),
          metadata: { line: { ...lineMetadata, delivery: "reserved" }, ai: aiMetadata } } });
        // Commit intent before sending. A crash/timeout cannot trigger an automatic
        // second reply. Ambiguous deliveries require operator reconciliation.
        await db.lineWebhookEvent.update({ where: { webhookEventId: job.eventId, merchantId: job.merchantId },
          data: { rawPayload: { version: 1, revision: job.revision, phase: "reply_reserved" } } });
        return message;
      });
      if (!outbound) return;
      await this.runtime.locked(job, async (db, channel) => {
        const { event } = await this.ownedJob(db, job);
        if ((event.rawPayload as { phase?: unknown }).phase !== "reply_reserved") return;
        if (await activeAiEpoch(db, job.merchantId) !== job.activationEpoch) {
          await db.message.update({ where: { id: outbound.id, merchantId: job.merchantId },
            data: { metadata: { line: { ...lineMetadata, delivery: "suppressed" }, ai: aiMetadata } } });
          await this.markAiDisabled(db, job, job.eventId);
          return;
        }
        const delivery = await this.provider.reply(this.runtime.accessToken(channel), input.replyToken, outbound.content);
        // Definitive provider authentication failure invalidates this revision's
        // readiness. Keep the ownership reservation until explicit disconnect.
        if (delivery.statusCode === 401) {
          await db.channel.update({ where: { id: channel.id, merchantId: job.merchantId }, data: {
            status: "ERROR", isConnected: false, credentialsVerifiedAt: null, webhookVerifiedAt: null,
            credentialRevision: { increment: 1 },
          } });
        }
        await db.message.update({ where: { id: outbound.id, merchantId: job.merchantId },
          data: { metadata: { line: { ...lineMetadata, delivery: delivery.outcome,
            ...(delivery.statusCode ? { statusCode: delivery.statusCode } : {}) }, ai: aiMetadata } } });
        await db.conversation.update({ where: { id: job.conversationId, merchantId: job.merchantId }, data: { lastMessageAt: new Date() } });
        await db.lineWebhookEvent.update({ where: { id: event.id, merchantId: job.merchantId },
          data: { processedAt: new Date(), rawPayload: { version: 1, revision: job.revision, phase: delivery.outcome } } });
      });
    } catch {
      // Never log customer text or provider errors. Reserved replies remain
      // uncertain for reconciliation; failed/stale AI requests are not repeated.
      await this.prisma.lineWebhookEvent.updateMany({ where: { webhookEventId: job.eventId, merchantId: job.merchantId,
        channelId: job.channelId, processedAt: null, rawPayload: { path: ["phase"], equals: "ai_started" } },
        data: { processedAt: new Date(), rawPayload: { version: 1, revision: job.revision, phase: "failed_or_stale" } } }).catch(() => undefined);
    }
  }
}
