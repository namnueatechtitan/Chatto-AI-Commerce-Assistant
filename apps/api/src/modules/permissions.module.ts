/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource permissions สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const PermissionsModule = createPlaceholderResourceModule({
  resourceName: "permissions",
  route: "permissions",
  description: "Permission management",
});
