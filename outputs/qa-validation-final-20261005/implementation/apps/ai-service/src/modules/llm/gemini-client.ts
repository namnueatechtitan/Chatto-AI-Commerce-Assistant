import type {
  GenerateLlmReplyInput,
  GenerateLlmReplyResult,
} from "./llm.types";

interface GeminiContentPart {
  text?: string;
  type?: string;
}

interface GeminiInteractionStep {
  type?: string;
  content?: GeminiContentPart[];
  text?: string;
}

interface GeminiInteractionResponse {
  output_text?: string;
  status?: string;
  steps?: GeminiInteractionStep[];
  error?: {
    message?: string;
  };
}

export function extractGeminiText(payload: GeminiInteractionResponse): string {
  const legacyText = payload.output_text?.trim();

  if (legacyText) {
    return legacyText;
  }

  const modelOutputSteps = (payload.steps ?? []).filter(
    (step) => step.type === "model_output",
  );

  return modelOutputSteps
    .flatMap((step) => [
      step.text,
      ...(step.content ?? [])
        .filter((part) => !part.type || part.type === "output_text" || part.type === "text")
        .map((part) => part.text),
    ])
    .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
    .map((text) => text.trim())
    .join("\n")
    .trim();
}

export class GeminiClient {
  private readonly apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  private readonly model =
    process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
  private readonly endpoint =
    process.env.GEMINI_API_BASE_URL?.trim() ??
    "https://generativelanguage.googleapis.com/v1/interactions";
  private readonly timeoutMs = this.resolveTimeoutMs();

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  getModel(): string {
    return this.model;
  }

  async generateReply(
    input: GenerateLlmReplyInput,
  ): Promise<GenerateLlmReplyResult> {
    const startedAt = Date.now();

    if (!this.isConfigured()) {
      return {
        provider: "gemini",
        model: this.model,
        text: input.fallbackReply,
        usedExternalProvider: false,
        latencyMs: Date.now() - startedAt,
        error: "GEMINI_API_KEY is not configured",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          model: this.model,
          system_instruction: input.systemInstruction,
          input: this.buildUserInput(input),
          generation_config: {
            thinking_level: "minimal",
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as GeminiInteractionResponse;

      if (!response.ok) {
        return {
          provider: "gemini",
          model: this.model,
          text: input.fallbackReply,
          usedExternalProvider: false,
          latencyMs: Date.now() - startedAt,
          error: payload.error?.message ?? response.statusText,
        };
      }

      const text = extractGeminiText(payload);

      return {
        provider: "gemini",
        model: this.model,
        text: text || input.fallbackReply,
        usedExternalProvider: Boolean(text),
        latencyMs: Date.now() - startedAt,
        error: text
          ? undefined
          : `Gemini returned no model output (status: ${payload.status ?? "unknown"})`,
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";

      return {
        provider: "gemini",
        model: this.model,
        text: input.fallbackReply,
        usedExternalProvider: false,
        latencyMs: Date.now() - startedAt,
        timedOut,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUserInput(input: GenerateLlmReplyInput): string {
    const storeName = input.merchantSettings?.store_name ?? "the store";
    const botName = input.merchantSettings?.bot_name ?? "Chatto";
    const sources = input.retrievedChunks
      .map(
        (chunk, index) =>
          `${index + 1}. [${chunk.source_type}:${chunk.source_id}] ${chunk.chunk_text}`,
      )
      .join("\n");

    return [
      `Store: ${storeName}`,
      `Bot name: ${botName}`,
      `Intent: ${input.intent}`,
      `Reply language: ${input.language}`,
      `Customer message: ${input.customerMessage}`,
      "",
      "Recent conversation (oldest to newest):",
      input.conversationHistory.length > 0
        ? input.conversationHistory
            .map((item) => `${item.sender_type}: ${item.content}`)
            .join("\n")
        : "No earlier conversation messages.",
      "",
      "Relevant live store context:",
      sources || "No matching store context was found.",
    ].join("\n");
  }

  private resolveTimeoutMs(): number {
    const configured = Number(process.env.GEMINI_TIMEOUT_MS);

    if (Number.isFinite(configured) && configured >= 1000) {
      return configured;
    }

    return 10000;
  }
}
