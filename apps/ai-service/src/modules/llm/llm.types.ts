import type {
  AiConversationMessage,
  MerchantSettingsForAi,
  RagRetrievedChunk,
} from "../../types/ai-contract.types";
import type { RequestControl } from "../../request-budget";

export type LlmProviderName = "mock" | "gemini" | "openai";

export interface GenerateLlmReplyInput {
  control?: RequestControl;
  intent: string;
  customerMessage: string;
  language: string;
  conversationHistory: AiConversationMessage[];
  fallbackReply: string;
  merchantSettings?: MerchantSettingsForAi;
  retrievedChunks: RagRetrievedChunk[];
  systemInstruction: string;
}

export interface GenerateLlmReplyResult {
  provider: LlmProviderName;
  model: string | null;
  text: string;
  usedExternalProvider: boolean;
  latencyMs: number;
  timedOut?: boolean;
  error?: string;
  requestAttempted?: boolean;
  errorCategory?: GenerationErrorCategory;
  httpStatus?: number;
}

export type GenerationErrorCategory = "not_configured" | "timeout" | "authentication" | "rate_limit" | "http_error" | "empty_output" | "invalid_response" | "network_error" | "merchant_policy" | "provider_disabled" | "deadline_exceeded" | "cancelled";
