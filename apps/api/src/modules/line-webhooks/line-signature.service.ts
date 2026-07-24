/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ logic สำหรับตรวจสอบลายเซ็นของ LINE webhook ก่อนรับข้อมูลเข้าระบบ
 */

import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * หน้าที่: service นี้รับผิดชอบ logic ของ LINE Signature
 */
@Injectable()
export class LineSignatureService {
  /**
   * หน้าที่: ประกอบ dependency ที่คลาสนี้ต้องใช้ระหว่างการทำงาน
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * หน้าที่: ตรวจสอบลายเซ็นของ LINE webhook ด้วย channel secret เพื่อยืนยันว่าคำขอมาจาก LINE จริง
   */
  verifySignature(rawBody: Buffer, signature: string): boolean {
    const channelSecret = this.getChannelSecret();
    const expectedSignature = createHmac("sha256", channelSecret)
      .update(rawBody)
      .digest("base64");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  /**
   * หน้าที่: ดึง LINE channel secret จาก environment และโยน error ทันทีถ้ายังไม่ได้ตั้งค่า
   */
  private getChannelSecret(): string {
    const channelSecret = this.configService
      .get<string>("LINE_CHANNEL_SECRET")
      ?.trim();

    if (!channelSecret) {
      throw new InternalServerErrorException(
        "LINE_CHANNEL_SECRET is not configured",
      );
    }

    return channelSecret;
  }
}
