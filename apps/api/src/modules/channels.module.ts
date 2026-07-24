/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล placeholder ของ resource channels สำหรับใช้เป็น scaffold ใน Phase 2
 */

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const ChannelsModule = createPlaceholderResourceModule({
  resourceName: "channels",
  route: "channels",
  description: "Channel management",
});
