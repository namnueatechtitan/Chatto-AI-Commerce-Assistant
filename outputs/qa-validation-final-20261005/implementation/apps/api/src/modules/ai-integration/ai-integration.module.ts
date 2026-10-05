import { Module } from "@nestjs/common";
import { InternalAiModule } from "../internal-ai/internal-ai.module";
import { AiIntegrationService } from "./ai-integration.service";
import { AiSafetyService } from "./ai-safety.service";

@Module({
  imports: [InternalAiModule],
  providers: [AiIntegrationService, AiSafetyService],
  exports: [AiIntegrationService],
})
export class AiIntegrationModule {}
