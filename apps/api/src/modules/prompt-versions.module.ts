/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource prompt-versions สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const PromptVersionsModule = createPlaceholderResourceModule({
  resourceName: "prompt-versions",
  route: "prompt-versions",
  description: "Prompt version management",
});
