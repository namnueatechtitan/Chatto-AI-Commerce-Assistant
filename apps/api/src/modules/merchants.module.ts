/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource merchants สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const MerchantsModule = createPlaceholderResourceModule({
  resourceName: "merchants",
  route: "merchants",
  description: "Merchant management",
});
