/**
 * หน้าที่ไฟล์: ไฟล์นี้เปิด endpoint รับ webhook จาก LINE Messaging API และส่งต่อให้ service ประมวลผล
 */

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { LineWebhooksService } from "./line-webhooks.service";
import type {
  LineWebhookHandleResult,
  LineWebhookRequestBody,
} from "./types/line-webhook.types";

interface RawBodyRequest {
  rawBody?: Buffer;
}

/**
 * หน้าที่: controller นี้เปิด endpoint ของ LINE Webhooks
 */
@ApiTags("webhooks")
@Controller("webhooks")
export class LineWebhooksController {
  /**
   * หน้าที่: ประกอบ dependency ที่คลาสนี้ต้องใช้ระหว่างการทำงาน
   */
  constructor(private readonly lineWebhooksService: LineWebhooksService) {}

  /**
   * หน้าที่: จัดการ LINE Webhook ตาม flow ที่เมธอดนี้กำหนด
   */
  @Post("line")
  @HttpCode(200)
  @ApiOperation({ summary: "Receive LINE Messaging API webhooks" })
  async handleLineWebhook(
    @Body() payload: LineWebhookRequestBody,
    @Headers("x-line-signature") signature: string | undefined,
    @Req() request: RawBodyRequest,
  ): Promise<LineWebhookHandleResult> {
    return this.lineWebhooksService.handleWebhook(
      payload,
      signature,
      request.rawBody,
    );
  }
}
