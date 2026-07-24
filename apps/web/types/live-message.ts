/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ type ของข้อมูลข้อความสดที่ใช้ในหน้า dashboard
 */

export interface LiveMessage {
  id: string;
  customerName: string;
  customerAvatar?: string;
  message: string;
  timestamp: string;
  unread: boolean;
  channel: "LINE";
}
