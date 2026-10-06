import type { DashboardConversation } from "./dashboard-model";
import type { RecentOrder, MessageOverviewPoint } from "./mock-data";
export interface BusinessMetric { id: string; label: string; value: string }
// TODO: Replace with Dashboard analytics API when available.
// Presentation fixtures only. No commerce, inventory, delivery or provider calls.
export const dashboardPreviewCopy = { inventoryAlert: "สินค้าใกล้หมด 3 รายการ !", issue: "สอบถามสินค้า" };
export const businessMetrics: BusinessMetric[] = [
  { id: "revenue", label: "ยอดขายรวม", value: "฿56,980" },
  { id: "orders", label: "คำสั่งซื้อ", value: "412" },
  { id: "average", label: "เฉลี่ยต่อออเดอร์", value: "฿138" },
  { id: "refund", label: "อัตราคืนเงิน/ยกเลิก", value: "2.1%" },
  { id: "ai-success", label: "แชทที่ AI ตอบสำเร็จ", value: "2.1%" },
];
export const messageTrend: (MessageOverviewPoint & { handover: number })[] = [
  { label: "24 พ.ค.", total: 24, ai: 20, handover: 4 }, { label: "25 พ.ค.", total: 45, ai: 32, handover: 7 },
  { label: "26 พ.ค.", total: 60, ai: 43, handover: 10 }, { label: "27 พ.ค.", total: 55, ai: 39, handover: 9 },
  { label: "28 พ.ค.", total: 86, ai: 58, handover: 13 }, { label: "29 พ.ค.", total: 108, ai: 71, handover: 14 },
  { label: "30 พ.ค.", total: 100, ai: 62, handover: 16 },
];
export const previewConversations: DashboardConversation[] = [
  { id: "preview-tofu", customerName: "น้องเต้าหู้", message: "สวัสดีค่ะ เสื้อที่สั่งไปไซส์ M ใส่แล้วคับไปหน่อย", timestamp: "2026-06-06T03:38:00Z", unread: true, channel: "LINE", ownership: "WAITING_HANDOVER", previewReplies: [{ text: "ทางร้านต้องขออภัยด้วยนะคะ", timestamp: "2026-06-06T03:39:00Z" }, { text: "ลูกค้าสามารถแลกเปลี่ยนไซส์ได้ภายใน 7 วันหลังได้รับสินค้าค่ะ", timestamp: "2026-06-06T03:40:00Z" }] },
  { id: "preview-turtle", customerName: "พี่เต่ารวย", message: "ขอสอบถามข้อมูลเพิ่มเติมค่ะ", timestamp: "2026-06-06T03:35:00Z", unread: false, channel: "LINE", ownership: "HUMAN" },
  { id: "preview-friend", customerName: "เพื่อนน้องเต้าหู้", message: "ขอเปลี่ยนสินค้าได้ไหมคะ", timestamp: "2026-06-06T03:32:00Z", unread: true, channel: "LINE", ownership: "AI" },
];
export const previewOrders: RecentOrder[] = [
  { id: "#ORD-250530-0012", customer: "คุณณัฐธิรา", amount: "฿1,290", status: "paid" },
  { id: "#ORD-250530-0011", customer: "คุณปวีณา", amount: "฿8,690", status: "cancelled" },
  { id: "#ORD-250530-0010", customer: "คุณศักดิ์ชัย", amount: "฿8,980", status: "pending" },
  { id: "#ORD-250530-0009", customer: "คุณจิรสรา", amount: "฿1,290", status: "paid" },
  { id: "#ORD-250530-0008", customer: "คุณวรรณพ", amount: "฿890", status: "cancelled" },
  { id: "#ORD-250530-0007", customer: "คุณอนุกัน", amount: "฿8,980", status: "pending" },
  { id: "#ORD-250530-0006", customer: "คุณลลิตา", amount: "฿590", status: "cancelled" },
  { id: "#ORD-250530-0005", customer: "คุณกรุณา", amount: "฿28,980", status: "pending" },
];
