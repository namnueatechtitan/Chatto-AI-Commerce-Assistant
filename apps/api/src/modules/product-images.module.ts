/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource product-images สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const ProductImagesModule = createPlaceholderResourceModule({
  resourceName: "product-images",
  route: "product-images",
  description: "Product image management",
});
