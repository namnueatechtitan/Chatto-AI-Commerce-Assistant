/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource product-variants สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const ProductVariantsModule = createPlaceholderResourceModule({
  resourceName: "product-variants",
  route: "product-variants",
  description: "Product variant management",
});
