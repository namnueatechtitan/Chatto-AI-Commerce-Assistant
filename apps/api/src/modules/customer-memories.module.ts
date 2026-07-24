/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource customer-memories สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const CustomerMemoriesModule = createPlaceholderResourceModule({
  resourceName: "customer-memories",
  route: "customer-memories",
  description: "Customer memory management",
});
