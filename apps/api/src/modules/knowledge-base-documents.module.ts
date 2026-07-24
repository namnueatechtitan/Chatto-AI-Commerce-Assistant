/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource knowledge-base-documents สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const KnowledgeBaseDocumentsModule = createPlaceholderResourceModule({
  resourceName: "knowledge-base-documents",
  route: "knowledge-base-documents",
  description: "Knowledge base document management",
});
