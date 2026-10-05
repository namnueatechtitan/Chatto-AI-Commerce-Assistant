import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Param,
  ParseUUIDPipe,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { LineWebhooksService } from "./line-webhooks.service";
import type {
  LineWebhookHandleResult,
  LineWebhookRequestBody,
} from "./types/line-webhook.types";

interface RawBodyRequest {
  rawBody?: Buffer;
}

@ApiTags("webhooks")
@Controller("webhooks")
export class LineWebhooksController {
  constructor(private readonly lineWebhooksService: LineWebhooksService) {}

  @Post("line")
  @HttpCode(200)
  @ApiOperation({ summary: "Receive LINE Messaging API webhooks" })
  async handleLineWebhook(
    @Body() payload: LineWebhookRequestBody,
    @Headers("x-line-signature") signature: string | undefined,
    @Req() request: RawBodyRequest,
  ): Promise<LineWebhookHandleResult> {
    return this.lineWebhooksService.handleWebhook(
      payload,
      signature,
      request.rawBody,
    );
  }

  @Post("line/:channelId")
  @HttpCode(200)
  @ApiOperation({ summary: "Receive a signed webhook for a verified merchant LINE channel" })
  receive(@Param("channelId", ParseUUIDPipe) channelId: string,
    @Headers("x-line-signature") signature: string | undefined, @Req() request: RawBodyRequest) {
    return this.lineWebhooksService.receive(channelId.toLowerCase(), signature, request.rawBody);
  }
}
