/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ service stub ของโมดูล context builder ใน AI service ตามขอบเขตของ Phase 2
 */

/**
 * หน้าที่: คลาสนี้รับผิดชอบงานของ Context Builder ภายในไฟล์นี้
 */
export class ContextBuilder {
  /**
   * หน้าที่: ประกอบ context ขั้นต้นจาก merchant และข้อความสำหรับส่งต่อให้ขั้นตอน AI อื่น ๆ
   */
  buildContext(input: { merchantId?: string; message: string }) {
    return {
      merchantId: input.merchantId ?? null,
      message: input.message,
      products: [],
      knowledgeDocuments: [],
    };
  }
}
