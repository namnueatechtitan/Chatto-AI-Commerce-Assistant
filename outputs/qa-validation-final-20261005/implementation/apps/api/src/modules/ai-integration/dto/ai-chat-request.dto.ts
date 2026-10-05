import type { AiChatRequest } from "../ai-contract.types";

export class AiChatRequestDto implements AiChatRequest {
  request_id!: string;
  merchant_id!: string;
  channel!: "line" | "web_chat" | "messenger";
  conversation_id!: string;

  customer!: {
    id: string;
    display_name?: string;
  };

  message!: {
    id: string;
    text: string;
    timestamp: string;
  };

  ai_options?: {
    language?: string;
    top_k?: number;
  };
}
