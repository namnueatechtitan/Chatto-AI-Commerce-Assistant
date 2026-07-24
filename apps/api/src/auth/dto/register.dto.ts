/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ DTO สำหรับรับข้อมูลการสมัครใช้งานจาก client
 */

import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

/**
 * หน้าที่: คลาสนี้รับผิดชอบงานของ สมัครใช้งาน DTO ภายในไฟล์นี้
 */
export class RegisterDto {
  @ApiProperty({ example: "merchant@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "strong-password" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: "Acme Store" })
  @IsString()
  shopName!: string;

  @ApiProperty({ example: "Alice Merchant" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "Retail", required: false })
  @IsOptional()
  @IsString()
  businessCategory?: string;
}
