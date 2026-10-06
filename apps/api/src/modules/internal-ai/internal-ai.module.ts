import { Module } from "@nestjs/common";
import { AiSettingsModule } from "../ai-settings.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { InternalServiceGuard } from "../../auth/internal-service.guard";
import { InternalAiController } from "./internal-ai.controller";
import { InternalAiService } from "./internal-ai.service";

@Module({
  imports: [PrismaModule, AiSettingsModule],
  controllers: [InternalAiController],
  providers: [InternalAiService, InternalServiceGuard],
  exports: [InternalAiService],
})
export class InternalAiModule {}
