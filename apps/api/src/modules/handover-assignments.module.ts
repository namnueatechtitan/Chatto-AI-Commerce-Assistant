/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource handover-assignments สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const HandoverAssignmentsModule = createPlaceholderResourceModule({
  resourceName: "handover-assignments",
  route: "handover-assignments",
  description: "Handover assignment management",
});
