/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource platforms สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const PlatformsModule = createPlaceholderResourceModule({
  resourceName: "platforms",
  route: "platforms",
  description: "Platform management",
});
