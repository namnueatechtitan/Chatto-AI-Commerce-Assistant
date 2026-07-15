import { GeminiClient } from "./gemini-client";
import type {
  GenerateLlmReplyInput,
  GenerateLlmReplyResult,
  LlmProviderName,
} from "./llm.types";

export class LlmReplyService {
  private readonly geminiClient = new GeminiClient();
  private readonly provider = this.resolveProvider();

  getProvider(): LlmProviderName {
    return this.provider;
  }

  isExternalProviderConfigured(): boolean {
    if (this.provider === "gemini") {
      return this.geminiClient.isConfigured();
    }

    if (this.provider === "openai") {
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    }

    return false;
  }

  async generateReply(
    input: GenerateLlmReplyInput,
  ): Promise<GenerateLlmReplyResult> {
    if (this.provider === "gemini") {
      return this.geminiClient.generateReply(input);
    }

    if (this.provider === "openai") {
      return {
        provider: "openai",
        model: process.env.OPENAI_MODEL?.trim() || null,
        text: input.fallbackReply,
        usedExternalProvider: false,
        latencyMs: 0,
        error: "OpenAI provider is reserved for future activation",
      };
    }

    return {
      provider: "mock",
      model: null,
      text: input.fallbackReply,
      usedExternalProvider: false,
      latencyMs: 0,
    };
  }

  private resolveProvider(): LlmProviderName {
    const provider = process.env.AI_LLM_PROVIDER?.trim().toLowerCase();

    if (provider === "gemini" || provider === "openai") {
      return provider;
    }

    return "mock";
  }
}
