import { Module } from "@nestjs/common";
import { InternalAiModule } from "../internal-ai/internal-ai.module";
import { AiIntegrationService } from "./ai-integration.service";

@Module({
  imports: [InternalAiModule],
  providers: [AiIntegrationService],
  exports: [AiIntegrationService],
})
export class AiIntegrationModule {}
