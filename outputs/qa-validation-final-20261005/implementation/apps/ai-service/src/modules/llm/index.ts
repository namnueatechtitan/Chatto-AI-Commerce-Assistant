import { GeminiClient } from "./gemini-client";
import { OllamaClient } from "./ollama-client";
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
    if (this.provider === "ollama") {
      const client = new OllamaClient();
      try {
        const result = await client.generateJson<{text:string}>(`${input.systemInstruction}\nReturn JSON {text:string}, use only supplied evidence.`, JSON.stringify(input));
        return {provider:"ollama",model:client.model,text:result.value.text,usedExternalProvider:true,latencyMs:result.metrics.wall_ms};
      } catch { return {provider:"ollama",model:client.model,text:input.fallbackReply,usedExternalProvider:false,latencyMs:0,error:"OLLAMA_UNAVAILABLE"}; }
    }
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
    const provider = process.env.AI_LLM_PROVIDER?.trim().toLowerCase() || "ollama";

    if (provider === "gemini" || provider === "openai" || provider === "ollama") {
      return provider;
    }

    return "mock";
  }
}
