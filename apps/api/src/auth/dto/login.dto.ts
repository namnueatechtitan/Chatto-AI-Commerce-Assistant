/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ DTO สำหรับรับข้อมูลการเข้าสู่ระบบจาก client
 */

import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

/**
 * หน้าที่: คลาสนี้รับผิดชอบงานของ Login DTO ภายในไฟล์นี้
 */
export class LoginDto {
  @ApiProperty({ example: "merchant@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "strong-password" })
  @IsString()
  @MinLength(8)
  password!: string;
}
