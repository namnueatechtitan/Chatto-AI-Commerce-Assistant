/**
 * หน้าที่ไฟล์: ไฟล์นี้เปิด endpoint สำหรับข้อมูลบทสนทนาและ feed ข้อความล่าสุดบน dashboard
 */

import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ConversationsService } from "./conversations.service";
import { LatestMessageDto } from "./dto/latest-message.dto";

/**
 * หน้าที่: controller นี้เปิด endpoint ของ Conversations
 */
@ApiTags("conversations")
@Controller("conversations")
export class ConversationsController {
  /**
   * หน้าที่: ประกอบ dependency ที่คลาสนี้ต้องใช้ระหว่างการทำงาน
   */
  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * หน้าที่: ดึงข้อความลูกค้าล่าสุดจากฐานข้อมูลและแปลงให้อยู่ในรูป DTO สำหรับ dashboard feed
   */
  @Get("messages/latest")
  @ApiOperation({ summary: "List latest customer messages for the dashboard feed" })
  @ApiOkResponse({
    description: "Latest customer LINE messages ordered by createdAt descending",
    type: LatestMessageDto,
    isArray: true,
  })
  findLatestMessages() {
    return this.conversationsService.findLatestMessages();
  }
}
