import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AiActionLogsModule } from "./modules/ai-action-logs.module";
import { AiSettingsModule } from "./modules/ai-settings.module";
import { ChannelsModule } from "./modules/channels.module";
import { ConversationsModule } from "./modules/conversations.module";
import { CustomerMemoriesModule } from "./modules/customer-memories.module";
import { CustomersModule } from "./modules/customers.module";
import { GuardrailEventsModule } from "./modules/guardrail-events.module";
import { HandoverAssignmentsModule } from "./modules/handover-assignments.module";
import { HandoverMessagesModule } from "./modules/handover-messages.module";
import { HandoverTicketsModule } from "./modules/handover-tickets.module";
import { KnowledgeBaseDocumentsModule } from "./modules/knowledge-base-documents.module";
import { LineWebhookEventsModule } from "./modules/line-webhook-events.module";
import { MerchantUsersModule } from "./modules/merchant-users.module";
import { MerchantsModule } from "./modules/merchants.module";
import { MessagesModule } from "./modules/messages.module";
import { PermissionsModule } from "./modules/permissions.module";
import { PlatformsModule } from "./modules/platforms.module";
import { ProductImagesModule } from "./modules/product-images.module";
import { ProductVariantsModule } from "./modules/product-variants.module";
import { ProductsModule } from "./modules/products.module";
import { PromptVersionsModule } from "./modules/prompt-versions.module";
import { RolesModule } from "./modules/roles.module";
import { UsersModule } from "./modules/users.module";
import { VectorDocumentsModule } from "./modules/vector-documents.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MerchantsModule,
    RolesModule,
    PermissionsModule,
    MerchantUsersModule,
    PlatformsModule,
    ChannelsModule,
    LineWebhookEventsModule,
    ProductsModule,
    ProductVariantsModule,
    ProductImagesModule,
    KnowledgeBaseDocumentsModule,
    VectorDocumentsModule,
    CustomersModule,
    ConversationsModule,
    MessagesModule,
    AiSettingsModule,
    PromptVersionsModule,
    AiActionLogsModule,
    GuardrailEventsModule,
    CustomerMemoriesModule,
    HandoverTicketsModule,
    HandoverMessagesModule,
    HandoverAssignmentsModule,
  ],
})
export class AppModule {}
