/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ service stub ของโมดูล openai client ใน AI service ตามขอบเขตของ Phase 2
 */

/**
 * หน้าที่: คลาสนี้รับผิดชอบงานของ Open AI Client Stub ภายในไฟล์นี้
 */
export class OpenAiClientStub {
  /**
   * หน้าที่: ตรวจสอบแบบ placeholder ว่าการเชื่อมต่อ OpenAI ถูกตั้งค่าไว้หรือยัง
   */
  isConfigured() {
    return false;
  }

  /**
   * หน้าที่: คืนค่าสถานะของ OpenAI integration ตามขอบเขตที่เลื่อนไปทำใน Phase 2.3
   */
  getStatus() {
    return "OpenAI integration deferred until Phase 2.3";
  }
}
