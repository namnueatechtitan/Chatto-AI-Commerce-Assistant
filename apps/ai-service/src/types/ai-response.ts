/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ shape ของผลลัพธ์ที่ AI service จะส่งกลับ
 */

export interface AiResponse {
  intent: string;
  confidence: number;
  reply: string;
  needs_handover: boolean;
  suggested_action: string | null;
}
