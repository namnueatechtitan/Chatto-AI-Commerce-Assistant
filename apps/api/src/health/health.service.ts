/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ service สำหรับสร้างข้อมูลสถานะระบบของ API
 */

import { Injectable } from "@nestjs/common";

/**
 * หน้าที่: service นี้รับผิดชอบ logic ของ สถานะระบบ
 */
@Injectable()
export class HealthService {
  /**
   * หน้าที่: คืนค่าสถานะปัจจุบันของบริการเพื่อใช้กับ health check
   */
  getHealth() {
    return {
      status: "ok",
      service: "chatto-api",
      phase: "phase-2-foundation",
      timestamp: new Date().toISOString(),
    };
  }
}
