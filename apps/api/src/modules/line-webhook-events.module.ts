/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource line-webhook-events สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const LineWebhookEventsModule = createPlaceholderResourceModule({
  resourceName: "line-webhook-events",
  route: "line-webhook-events",
  description: "LINE webhook event management",
});
