/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource handover-tickets สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const HandoverTicketsModule = createPlaceholderResourceModule({
  resourceName: "handover-tickets",
  route: "handover-tickets",
  description: "Handover ticket management",
});
