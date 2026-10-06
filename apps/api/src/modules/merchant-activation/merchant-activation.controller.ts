import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ActivationCommandDto } from "./activation.dto";
import { ActivationRequest, MerchantActivationGuard } from "./merchant-activation.guard";
import { MerchantActivationService } from "./merchant-activation.service";
@Controller("merchants/:merchantId/activation")
@UseGuards(MerchantActivationGuard)
export class MerchantActivationController {
  constructor(private readonly activation: MerchantActivationService) {}
  @Get("readiness") @Header("Cache-Control", "private, no-store")
  read(@Req() request: ActivationRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string) {
    return this.activation.readiness(request.activationUserId, merchantId.toLowerCase());
  }
  @Post() @HttpCode(200) @Header("Cache-Control", "private, no-store")
  activate(@Req() request: ActivationRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Body() _command: ActivationCommandDto) {
    return this.activation.activate(request.activationUserId, merchantId.toLowerCase());
  }
  @Delete() @HttpCode(200) @Header("Cache-Control", "private, no-store")
  deactivate(@Req() request: ActivationRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Body() _command: ActivationCommandDto) {
    return this.activation.deactivate(request.activationUserId, merchantId.toLowerCase());
  }
}
