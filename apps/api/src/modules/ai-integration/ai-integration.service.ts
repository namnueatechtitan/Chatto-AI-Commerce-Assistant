import { BadGatewayException, Injectable } from "@nestjs/common";
import { configuredServiceToken } from "../../auth/service-token";
import { InternalAiService } from "../internal-ai/internal-ai.service";
import type { AiChatRequest, AiChatResponse } from "./ai-contract.types";
import { AiPolicyResolver } from "../merchant-ai-settings/ai-policy.resolver";

@Injectable()
export class AiIntegrationService {
  private readonly aiServiceBaseUrl =
    process.env.AI_SERVICE_BASE_URL ?? "http://localhost:5000";

  private readonly aiServiceTimeoutMs = this.resolveTimeoutMs(
    "AI_SERVICE_TIMEOUT_MS",
    20000,
  );

  constructor(private readonly internalAiService: InternalAiService) {}

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const serviceToken = configuredServiceToken("AI_SERVICE_TOKEN");
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
          Authorization: `Bearer ${serviceToken}`,
          "Content-Type": "application/json",
          "X-Request-Id": request.request_id,
          "X-Merchant-Id": request.merchant_id,
        },
        body: JSON.stringify(enrichedRequest),
      });

      if (!response.ok) {
        throw new BadGatewayException(`AI service failed with ${response.status}`);
      }

      const result = await response.json() as AiChatResponse | null;
      if (!result || result.request_id !== request.request_id || result.merchant_id !== request.merchant_id ||
          result.conversation_id !== request.conversation_id || typeof result.reply?.text !== "string") {
        throw new BadGatewayException("Invalid AI service response");
      }
      return result;
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
    const merchantSettings = await this.internalAiService.exportMerchantSettings(request.merchant_id);
    if (!merchantSettings.ai_profile) throw new BadGatewayException("AI settings are unavailable");
    const policy = new AiPolicyResolver().resolve(merchantSettings.ai_profile, request.message.text);
    const [
      products,
      knowledgeBase,
      vectorDocuments,
      conversationHistory,
    ] =
      await Promise.all([
        policy.products ? this.internalAiService.exportProducts(request.merchant_id) : { merchant_id: request.merchant_id, products: [] },
        policy.knowledge ? this.internalAiService.exportKnowledgeBase(request.merchant_id) : { merchant_id: request.merchant_id, knowledge_base: [] },
        policy.storedVectors ? this.internalAiService.exportVectorDocuments(request.merchant_id) : [],
        policy.history ? this.internalAiService.exportConversationHistory(
          request.merchant_id,
          request.conversation_id,
          request.message.id,
        ) : [],
      ]);

    return {
      ...request,
      ai_options: { ...request.ai_options, language: merchantSettings.ai_profile.language },
      ai_context: {
        policy_denied: policy.denied,
        vector_sync_allowed: policy.storedVectors,
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
