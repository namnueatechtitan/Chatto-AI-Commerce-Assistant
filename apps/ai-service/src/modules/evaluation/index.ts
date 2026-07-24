/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ service stub ของโมดูล evaluation ใน AI service ตามขอบเขตของ Phase 2
 */

import type { AiResponse } from "../../types/ai-response";

/**
 * หน้าที่: service นี้รับผิดชอบ logic ของ Evaluation
 */
export class EvaluationService {
  /**
   * หน้าที่: สรุปผลการประเมินคำตอบของ AI แบบ placeholder
   */
  summarize(response: AiResponse) {
    return {
      evaluationMode: "placeholder",
      responseIntent: response.intent,
      passed: true,
    };
  }
}
