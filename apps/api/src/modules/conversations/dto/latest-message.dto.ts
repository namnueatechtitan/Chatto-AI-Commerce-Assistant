/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ DTO ของข้อความล่าสุดที่ส่งกลับไปให้หน้า dashboard
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * หน้าที่: คลาสนี้รับผิดชอบงานของ Latest ข้อความ DTO ภายในไฟล์นี้
 */
export class LatestMessageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerName!: string;

  @ApiPropertyOptional()
  customerAvatar?: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({
    description: "ISO 8601 timestamp",
    example: "2026-06-20T11:41:13.000Z",
  })
  timestamp!: string;

  @ApiProperty()
  unread!: boolean;

  @ApiProperty({
    enum: ["LINE"],
    example: "LINE",
  })
  channel!: "LINE";
}
