import { Injectable } from "@nestjs/common";
import { InternalAiService } from "../internal-ai/internal-ai.service";
import type { AiChatRequest, AiChatResponse } from "./ai-contract.types";

@Injectable()
export class AiIntegrationService {
  private readonly aiServiceBaseUrl =
    process.env.AI_SERVICE_BASE_URL ?? "http://localhost:5000";

  private readonly serviceToken =
    process.env.AI_SERVICE_TOKEN ?? "dev_internal_service_token";

  private readonly aiServiceTimeoutMs = this.resolveTimeoutMs(
    "AI_SERVICE_TIMEOUT_MS",
    12000,
  );

  constructor(private readonly internalAiService: InternalAiService) {}

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const enrichedRequest = await this.withMerchantContext(request);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.aiServiceTimeoutMs,
    );

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
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `AI service failed with ${response.status}: ${errorText || response.statusText}`,
        );
      }

      return response.json() as Promise<AiChatResponse>;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `AI service timed out after ${this.aiServiceTimeoutMs}ms`,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
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
