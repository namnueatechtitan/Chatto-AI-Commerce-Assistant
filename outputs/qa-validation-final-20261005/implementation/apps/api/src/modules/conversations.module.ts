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

@Module({
  imports: [PlaceholderConversationsModule, PrismaModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
