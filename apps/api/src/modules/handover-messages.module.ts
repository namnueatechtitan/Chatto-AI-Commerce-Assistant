/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource handover-messages สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const HandoverMessagesModule = createPlaceholderResourceModule({
  resourceName: "handover-messages",
  route: "handover-messages",
  description: "Handover message management",
});
