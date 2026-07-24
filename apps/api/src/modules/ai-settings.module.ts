/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource ai-settings สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const AiSettingsModule = createPlaceholderResourceModule({
  resourceName: "ai-settings",
  route: "ai-settings",
  description: "AI settings management",
});
