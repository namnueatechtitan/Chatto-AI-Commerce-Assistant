/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ auth service แบบ scaffold ของ Phase 2 สำหรับสมัครสมาชิก เข้าสู่ระบบ และดูโปรไฟล์
 */

import { Injectable } from "@nestjs/common";

import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

/**
 * หน้าที่: service นี้รับผิดชอบ logic ของ Auth
 */
@Injectable()
export class AuthService {
  /**
   * หน้าที่: สร้าง response scaffold สำหรับการสมัครใช้งานร้านค้าใน Phase 2
   */
  register(payload: RegisterDto) {
    return {
      message: "Phase 2 register scaffold",
      user: {
        id: "placeholder-user-id",
        email: payload.email,
        name: payload.name,
      },
      merchant: {
        id: "placeholder-merchant-id",
        shopName: payload.shopName,
        businessCategory: payload.businessCategory ?? null,
      },
      tokens: {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      },
    };
  }

  /**
   * หน้าที่: สร้าง response scaffold สำหรับการเข้าสู่ระบบใน Phase 2
   */
  login(payload: LoginDto) {
    return {
      message: "Phase 2 login scaffold",
      user: {
        id: "placeholder-user-id",
        email: payload.email,
      },
      tokens: {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      },
    };
  }

  /**
   * หน้าที่: คืนค่าโปรไฟล์ตัวอย่างของผู้ใช้ที่ล็อกอินอยู่ใน Phase 2
   */
  profile() {
    return {
      message: "Phase 2 auth profile scaffold",
      user: {
        id: "placeholder-user-id",
        email: "merchant@example.com",
        name: "Alice Merchant",
        merchantId: "placeholder-merchant-id",
      },
    };
  }
}
