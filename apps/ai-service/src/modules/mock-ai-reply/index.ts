import type { AiResponse } from "../../types/ai-response";

export const mockAiResponse: AiResponse = {
  intent: "general_question",
  confidence: 0.8,
  reply: "Mock AI response from Chatto AI Service",
  needs_handover: false,
  suggested_action: null,
};

export class MockAiReplyService {
  generateReply(input: { intent: string; confidence: number }): AiResponse {
    return {
      ...mockAiResponse,
      intent: input.intent,
      confidence: input.confidence,
    };
  }
}
