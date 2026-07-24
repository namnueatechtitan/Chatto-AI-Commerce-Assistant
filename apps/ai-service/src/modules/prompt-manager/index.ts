/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ service stub ของโมดูล prompt manager ใน AI service ตามขอบเขตของ Phase 2
 */

/**
 * หน้าที่: คลาสนี้รับผิดชอบงานของ Prompt Manager ภายในไฟล์นี้
 */
export class PromptManager {
  /**
   * หน้าที่: คืน prompt scaffold ตามชื่อที่ร้องขอ
   */
  getPrompt(name: string) {
    return {
      name,
      version: 1,
      systemPrompt: "Phase 2 prompt scaffold",
    };
  }
}
