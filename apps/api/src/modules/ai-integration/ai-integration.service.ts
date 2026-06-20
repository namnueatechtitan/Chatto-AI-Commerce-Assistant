import { Injectable } from "@nestjs/common";
import type { AiChatRequest, AiChatResponse } from "./ai-contract.types";

@Injectable()
export class AiIntegrationService {
  private readonly aiServiceBaseUrl =
    process.env.AI_SERVICE_BASE_URL ?? "http://localhost:5000";

  private readonly serviceToken =
    process.env.AI_SERVICE_TOKEN ?? "dev_internal_service_token";

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const response = await fetch(`${this.aiServiceBaseUrl}/ai/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.serviceToken}`,
        "Content-Type": "application/json",
        "X-Request-Id": request.request_id,
        "X-Merchant-Id": request.merchant_id,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `AI service failed with ${response.status}: ${errorText || response.statusText}`,
      );
    }

    return response.json() as Promise<AiChatResponse>;
  }
}
