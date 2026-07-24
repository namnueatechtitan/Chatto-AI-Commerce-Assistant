/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ service stub ของโมดูล mock AI reply ใน AI service ตามขอบเขตของ Phase 2
 */

import type { AiResponse } from "../../types/ai-response";

export const mockAiResponse: AiResponse = {
  intent: "general_question",
  confidence: 0.8,
  reply: "Mock AI response from Chatto AI Service",
  needs_handover: false,
  suggested_action: null,
};

/**
 * หน้าที่: service นี้รับผิดชอบ logic ของ Mock AI Reply
 */
export class MockAiReplyService {
  /**
   * หน้าที่: สร้างคำตอบ mock โดยอิงจาก intent และ confidence ที่ประเมินได้
   */
  generateReply(input: { intent: string; confidence: number }): AiResponse {
    return {
      ...mockAiResponse,
      intent: input.intent,
      confidence: input.confidence,
    };
  }
}
