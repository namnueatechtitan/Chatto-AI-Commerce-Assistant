import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";
import { PrismaModule } from "../prisma/prisma.module";
import { ConversationsController } from "./conversations/conversations.controller";
import { ConversationsService } from "./conversations/conversations.service";
import { MerchantsModule } from "./merchants.module";

const PlaceholderConversationsModule = createPlaceholderResourceModule({
  resourceName: "conversations",
  route: "conversations",
  description: "Conversation management",
});

@Module({
  imports: [PlaceholderConversationsModule, PrismaModule, AuthModule, MerchantsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
