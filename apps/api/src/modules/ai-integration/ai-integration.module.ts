import { Module } from "@nestjs/common";
import { AiIntegrationService } from "./ai-integration.service";

@Module({
  providers: [AiIntegrationService],
  exports: [AiIntegrationService],
})
export class AiIntegrationModule {}
