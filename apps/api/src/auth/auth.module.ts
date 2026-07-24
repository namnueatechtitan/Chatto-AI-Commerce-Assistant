/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ auth module สำหรับรวม controller และ service ของงานยืนยันตัวตน
 */

import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/**
 * หน้าที่: โมดูลนี้รวบรวม dependency ของ Auth
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
