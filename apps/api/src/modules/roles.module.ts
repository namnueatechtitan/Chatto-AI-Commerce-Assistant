/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource roles สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const RolesModule = createPlaceholderResourceModule({
  resourceName: "roles",
  route: "roles",
  description: "Role management",
});
