import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ConfigureLineDto, LineRevisionDto } from "./merchant-line.dto";
import { LineRequest, MerchantLineGuard } from "./merchant-line.guard";
import { MerchantLineService } from "./merchant-line.service";
@Controller("merchants/:merchantId/line-channel")
@UseGuards(MerchantLineGuard)
export class MerchantLineController {
  constructor(private readonly line: MerchantLineService) {}
  @Get() @Header("Cache-Control", "private, no-store")
  read(@Req() req: LineRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string) {
    return this.line.read(req.lineUserId, merchantId);
  }
  @Put() @Header("Cache-Control", "private, no-store")
  configure(@Req() req: LineRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string, @Body() input: ConfigureLineDto) {
    return this.line.configure(req.lineUserId, merchantId, input);
  }
  @Post(":channelId/verify") @Header("Cache-Control", "private, no-store")
  verify(@Req() req: LineRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string,
    @Param("channelId", ParseUUIDPipe) channelId: string, @Body() input: LineRevisionDto) {
    return this.line.verify(req.lineUserId, merchantId, channelId, input.expectedRevision);
  }
  @Post(":channelId/disconnect") @Header("Cache-Control", "private, no-store")
  disconnect(@Req() req: LineRequest, @Param("merchantId", ParseUUIDPipe) merchantId: string,
    @Param("channelId", ParseUUIDPipe) channelId: string, @Body() input: LineRevisionDto) {
    return this.line.disconnect(req.lineUserId, merchantId, channelId, input.expectedRevision);
  }
}
