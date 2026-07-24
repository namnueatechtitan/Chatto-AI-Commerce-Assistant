/**
 * หน้าที่ไฟล์: ไฟล์นี้เปิด endpoint health check ของ API เพื่อใช้ตรวจสอบว่าส่วนบริการยังทำงานอยู่หรือไม่
 */

import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { HealthService } from "./health.service";

/**
 * หน้าที่: controller นี้เปิด endpoint ของ สถานะระบบ
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  /**
   * หน้าที่: ประกอบ dependency ที่คลาสนี้ต้องใช้ระหว่างการทำงาน
   */
  constructor(private readonly healthService: HealthService) {}

  /**
   * หน้าที่: คืนค่าสถานะปัจจุบันของบริการเพื่อใช้กับ health check
   */
  @Get()
  @ApiOperation({ summary: "Health check endpoint" })
  getHealth() {
    return this.healthService.getHealth();
  }
}
