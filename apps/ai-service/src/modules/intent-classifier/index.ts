/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ service stub ของโมดูล intent classifier ใน AI service ตามขอบเขตของ Phase 2
 */

/**
 * หน้าที่: คลาสนี้รับผิดชอบงานของ Intent Classifier ภายในไฟล์นี้
 */
export class IntentClassifier {
  /**
   * หน้าที่: จำแนก intent ของข้อความแบบง่ายเพื่อใช้กับ flow ทดสอบของ AI service
   */
  classify(message: string) {
    return {
      intent: message.trim() ? "general_question" : "empty_message",
      confidence: message.trim() ? 0.8 : 0.2,
    };
  }
}
