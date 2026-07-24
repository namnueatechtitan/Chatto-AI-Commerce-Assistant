/**
 * หน้าที่ไฟล์: ไฟล์นี้เปิด endpoint ด้าน auth ของ API และส่งงานต่อไปยัง AuthService
 */

import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

/**
 * หน้าที่: controller นี้เปิด endpoint ของ Auth
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  /**
   * หน้าที่: ประกอบ dependency ที่คลาสนี้ต้องใช้ระหว่างการทำงาน
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * หน้าที่: สร้าง response scaffold สำหรับการสมัครใช้งานร้านค้าใน Phase 2
   */
  @Post("register")
  @ApiOperation({ summary: "Register a merchant user placeholder" })
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  /**
   * หน้าที่: สร้าง response scaffold สำหรับการเข้าสู่ระบบใน Phase 2
   */
  @Post("login")
  @ApiOperation({ summary: "Login placeholder" })
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  /**
   * หน้าที่: คืนค่าโปรไฟล์ตัวอย่างของผู้ใช้ที่ล็อกอินอยู่ใน Phase 2
   */
  @Get("profile")
  @ApiOperation({ summary: "Current merchant profile placeholder" })
  profile() {
    return this.authService.profile();
  }
}
