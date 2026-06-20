import type { LiveMessage } from "../types/live-message";

export const mockLiveMessages: LiveMessage[] = [
  {
    id: "1",
    customerName: "สมชาย",
    message: "มีโปรสำหรับสินค้าตัวนี้ไหมครับ",
    timestamp: "11:32:45",
    unread: true,
    channel: "LINE",
  },
  {
    id: "2",
    customerName: "Jane",
    message: "ส่งเชียงใหม่กี่วันคะ",
    timestamp: "11:31:20",
    unread: false,
    channel: "LINE",
  },
  {
    id: "3",
    customerName: "Narin",
    message: "สินค้าตัวนี้มีไซส์ L ไหมครับ",
    timestamp: "11:30:05",
    unread: true,
    channel: "LINE",
  },
];
