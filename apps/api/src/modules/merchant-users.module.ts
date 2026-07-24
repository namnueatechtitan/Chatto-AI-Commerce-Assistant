/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource merchant-users สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const MerchantUsersModule = createPlaceholderResourceModule({
  resourceName: "merchant-users",
  route: "merchant-users",
  description: "Merchant user management",
});
