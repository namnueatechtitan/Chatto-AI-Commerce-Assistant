import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { AiSettingsRequest, MerchantAiSettingsGuard } from "./merchant-ai-settings.guard";
import { UpdateMerchantAiSettingsDto } from "./merchant-ai-settings.dto";
import { MerchantAiSettingsService } from "./merchant-ai-settings.service";

@Controller("merchants/:merchantId/ai-settings")
@UseGuards(MerchantAiSettingsGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true,
  validationError: { target: false, value: false } }))
export class MerchantAiSettingsController {
  constructor(private readonly settings: MerchantAiSettingsService) {}
  @Get() @Header("Cache-Control", "private, no-store")
  async read(@Req() request: AiSettingsRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string) {
    return this.settings.read(request.aiSettingsUserId, merchantId.toLowerCase());
  }
  @Patch() @Header("Cache-Control", "private, no-store")
  async update(@Req() request: AiSettingsRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Body() input: UpdateMerchantAiSettingsDto) {
    return this.settings.update(request.aiSettingsUserId, merchantId.toLowerCase(), input);
  }
}
