import type {
  AiConversationMessage,
  MerchantSettingsForAi,
  RagRetrievedChunk,
} from "../../types/ai-contract.types";

export type LlmProviderName = "mock" | "gemini" | "openai";

export interface GenerateLlmReplyInput {
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
}
