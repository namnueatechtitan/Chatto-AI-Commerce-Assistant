/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource messages สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const MessagesModule = createPlaceholderResourceModule({
  resourceName: "messages",
  route: "messages",
  description: "Message management",
});
