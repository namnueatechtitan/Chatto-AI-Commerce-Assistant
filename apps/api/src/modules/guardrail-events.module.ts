/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource guardrail-events สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const GuardrailEventsModule = createPlaceholderResourceModule({
  resourceName: "guardrail-events",
  route: "guardrail-events",
  description: "Guardrail event management",
});
