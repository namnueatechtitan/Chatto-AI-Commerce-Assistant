import type { AiChatRequest } from "./ai-contract.types";

export interface BuildAiChatRequestInput {
  requestId: string;
  merchantId: string;
  channel: "line" | "web_chat" | "messenger";
  conversationId: string;
  customerId: string;
  customerDisplayName?: string;
  messageId: string;
  messageText: string;
  timestamp: string;
  language?: string;
}

export function buildAiChatRequest(input: BuildAiChatRequestInput): AiChatRequest {
  return {
    request_id: input.requestId,
    merchant_id: input.merchantId,
    channel: input.channel,
    conversation_id: input.conversationId,
    customer: {
      id: input.customerId,
      display_name: input.customerDisplayName,
    },
    message: {
      id: input.messageId,
      text: input.messageText,
      timestamp: input.timestamp,
    },
    ai_options: {
      language: input.language ?? "en",
      top_k: 5,
    },
  };
}
