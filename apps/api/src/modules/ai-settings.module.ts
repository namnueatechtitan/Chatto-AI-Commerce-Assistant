import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoreInformationModule } from "./store-information/store-information.module";
import { MerchantAiSettingsController } from "./merchant-ai-settings/merchant-ai-settings.controller";
import { MerchantAiSettingsService } from "./merchant-ai-settings/merchant-ai-settings.service";
import { MerchantAiSettingsGuard } from "./merchant-ai-settings/merchant-ai-settings.guard";
@Module({ imports: [AuthModule, StoreInformationModule], controllers: [MerchantAiSettingsController],
  providers: [MerchantAiSettingsService, MerchantAiSettingsGuard], exports: [MerchantAiSettingsService] })
export class AiSettingsModule {}
