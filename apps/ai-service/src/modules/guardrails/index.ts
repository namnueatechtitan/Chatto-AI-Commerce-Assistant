/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ service stub ของโมดูล guardrails ใน AI service ตามขอบเขตของ Phase 2
 */

/**
 * หน้าที่: service นี้รับผิดชอบ logic ของ Guardrail
 */
export class GuardrailService {
  /**
   * หน้าที่: ประเมินข้อความเบื้องต้นตามกฎ guardrail แบบ mock
   */
  evaluate(message: string) {
    return {
      allowed: true,
      severity: "low",
      reason: message ? "No guardrail issues detected in mock mode" : "Empty input",
    };
  }
}
