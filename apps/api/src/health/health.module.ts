/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ health module สำหรับ endpoint ตรวจสอบสถานะระบบ
 */

import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

/**
 * หน้าที่: โมดูลนี้รวบรวม dependency ของ สถานะระบบ
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
