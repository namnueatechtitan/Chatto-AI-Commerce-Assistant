/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศโมดูล conversations และเชื่อม controller กับ service ของ feed ข้อความล่าสุด
 */

import { Module } from "@nestjs/common";

import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";
import { PrismaModule } from "../prisma/prisma.module";
import { ConversationsController } from "./conversations/conversations.controller";
import { ConversationsService } from "./conversations/conversations.service";

const PlaceholderConversationsModule = createPlaceholderResourceModule({
  resourceName: "conversations",
  route: "conversations",
  description: "Conversation management",
});

/**
 * หน้าที่: โมดูลนี้รวบรวม dependency ของ Conversations
 */
@Module({
  imports: [PlaceholderConversationsModule, PrismaModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
