import { Module } from "@nestjs/common";

import { LineSignatureService } from "./line-signature.service";
import { LineWebhooksController } from "./line-webhooks.controller";
import { LineWebhooksService } from "./line-webhooks.service";

@Module({
  controllers: [LineWebhooksController],
  providers: [LineWebhooksService, LineSignatureService],
})
export class LineWebhooksModule {}
