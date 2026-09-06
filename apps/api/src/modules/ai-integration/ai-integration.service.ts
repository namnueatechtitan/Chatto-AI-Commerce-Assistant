import { ConflictException, Injectable } from "@nestjs/common";
import { InternalAiService } from "../internal-ai/internal-ai.service";
import type { AiChatRequest, AiChatResponse } from "./ai-contract.types";
import { AiSafetyService } from "./ai-safety.service";
import { assertAiChatResponse } from "./ai-response.validator";

@Injectable()
export class AiIntegrationService {
  private readonly aiServiceBaseUrl =
    process.env.AI_SERVICE_BASE_URL ?? "http://localhost:5000";

  private readonly serviceToken =
    process.env.AI_SERVICE_TOKEN ?? "dev_internal_service_token";

  private readonly aiServiceTimeoutMs = this.resolveTimeoutMs(
    "AI_SERVICE_TIMEOUT_MS",
    20000,
  );

  constructor(
    private readonly internalAiService: InternalAiService,
    private readonly safety: AiSafetyService,
  ) {}

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    if (!await this.safety.isAiActive(request)) {
      throw new ConflictException("Conversation is awaiting human support");
    }
    const enrichedRequest = await this.withMerchantContext(request);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.aiServiceTimeoutMs,
    );
    let result: AiChatResponse;

    try {
      const response = await fetch(`${this.aiServiceBaseUrl}/mcp/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.serviceToken}`,
          "Content-Type": "application/json",
          "X-Request-Id": request.request_id,
          "X-Merchant-Id": request.merchant_id,
        },
        body: JSON.stringify(enrichedRequest),
      });

      if (!response.ok) {
        throw new Error("AI_SERVICE_UNAVAILABLE");
      }

      const payload: unknown = await response.json();
      assertAiChatResponse(payload, request);
      result = payload;
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError"
        ? "AI_SERVICE_TIMEOUT" : "AI_SERVICE_UNAVAILABLE";
      result = this.unavailableResponse(request, reason);
    } finally {
      clearTimeout(timeout);
    }
    // Persistence errors and human takeover must not be converted into a second
    // fallback send. Auditing/state transition is a prerequisite for delivery.
    if (!await this.safety.record(request, result)) {
      throw new ConflictException("AI reply suppressed: duplicate request or human takeover");
    }
    return result;
  }

  private unavailableResponse(request: AiChatRequest, reason: string): AiChatResponse {
    const thai = /[\u0E00-\u0E7F]/u.test(request.message.text) || request.ai_options?.language === "th";
    return {
      request_id: request.request_id, merchant_id: request.merchant_id, conversation_id: request.conversation_id,
      intent: "unknown", reply: { confidence: 0, text: thai
        ? "ขออภัยครับ ระบบตอบอัตโนมัติไม่พร้อมใช้งาน จำเป็นต้องให้เจ้าหน้าที่ช่วยตรวจสอบครับ"
        : "The automated assistant is unavailable. A staff member needs to review this request." },
      actions: [], sources: [], handover_required: true, handover_reason: reason,
      confidence: { score: 0, threshold: 0.65, level: "low", decision: "handover", reasons: [reason], signals: { intent: 0, evidence: 0, source_count: 0 } },
      guardrails: [{ allowed: false, severity: "high", stage: "output", reasons: [reason], requires_handover: true }],
    };
  }

  private async withMerchantContext(
    request: AiChatRequest,
  ): Promise<AiChatRequest> {
    const [
      merchantSettings,
      products,
      knowledgeBase,
      vectorDocuments,
      conversationHistory,
    ] =
      await Promise.all([
        this.internalAiService.exportMerchantSettings(request.merchant_id),
        this.internalAiService.exportProducts(request.merchant_id),
        this.internalAiService.exportKnowledgeBase(request.merchant_id),
        this.internalAiService.exportVectorDocuments(request.merchant_id),
        this.internalAiService.exportConversationHistory(
          request.merchant_id,
          request.conversation_id,
          request.message.id,
        ),
      ]);

    return {
      ...request,
      ai_context: {
        merchant_settings: merchantSettings,
        products,
        knowledge_base: knowledgeBase,
        vector_documents: vectorDocuments,
        conversation_history: conversationHistory,
      },
    };
  }

  private resolveTimeoutMs(name: string, fallback: number): number {
    const configured = Number(process.env[name]);

    if (Number.isFinite(configured) && configured >= 1000) {
      return configured;
    }

    return fallback;
  }
}
