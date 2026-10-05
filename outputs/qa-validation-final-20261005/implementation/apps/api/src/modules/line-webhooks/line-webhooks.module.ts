import { Module } from "@nestjs/common";

import { AiIntegrationModule } from "../ai-integration/ai-integration.module";
import { LineSignatureService } from "./line-signature.service";
import { LineWebhooksController } from "./line-webhooks.controller";
import { LineWebhooksService } from "./line-webhooks.service";

@Module({
  imports: [AiIntegrationModule],
  controllers: [LineWebhooksController],
  providers: [LineWebhooksService, LineSignatureService],
})
export class LineWebhooksModule {}
