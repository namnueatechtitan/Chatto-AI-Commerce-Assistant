import { Module } from "@nestjs/common";

import { AiIntegrationModule } from "../ai-integration/ai-integration.module";
import { CredentialEncryptionModule } from "../../security/credential-encryption.module";
import { LineProviderAdapter } from "../merchant-line/line-provider.adapter";
import { LineChannelRuntimeService } from "./line-channel-runtime.service";
import { LineSignatureService } from "./line-signature.service";
import { LineWebhooksController } from "./line-webhooks.controller";
import { LineWebhooksService } from "./line-webhooks.service";

@Module({
  imports: [AiIntegrationModule, CredentialEncryptionModule],
  controllers: [LineWebhooksController],
  providers: [LineWebhooksService, LineSignatureService, LineChannelRuntimeService,
    { provide: LineProviderAdapter, useFactory: () => new LineProviderAdapter() }],
})
export class LineWebhooksModule {}
