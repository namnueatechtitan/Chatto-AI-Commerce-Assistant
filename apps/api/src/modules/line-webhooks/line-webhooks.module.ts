/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูลของ LINE webhooks และรวม dependency ที่เกี่ยวข้องไว้ด้วยกัน
 */

import { Module } from "@nestjs/common";

import { LineSignatureService } from "./line-signature.service";
import { LineWebhooksController } from "./line-webhooks.controller";
import { LineWebhooksService } from "./line-webhooks.service";

/**
 * หน้าที่: โมดูลนี้รวบรวม dependency ของ LINE Webhooks
 */
@Module({
  controllers: [LineWebhooksController],
  providers: [LineWebhooksService, LineSignatureService],
})
export class LineWebhooksModule {}
