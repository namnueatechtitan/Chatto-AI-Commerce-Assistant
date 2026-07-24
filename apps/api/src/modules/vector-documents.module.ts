/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource vector-documents สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const VectorDocumentsModule = createPlaceholderResourceModule({
  resourceName: "vector-documents",
  route: "vector-documents",
  description: "Vector document management",
});
