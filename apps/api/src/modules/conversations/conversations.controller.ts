import { BadRequestException, Controller, Get, Header, ParseUUIDPipe, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AuthSessionService, SESSION_COOKIE } from "../../auth/auth-session.service";
import { readCookie } from "../../auth/auth-http";
import { ConversationsService } from "./conversations.service";
import { LatestMessageDto } from "./dto/latest-message.dto";

@ApiTags("conversations")
@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly sessions: AuthSessionService,
  ) {}

  @Get("messages/latest")
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ summary: "List latest customer messages for an authenticated merchant member" })
  @ApiQuery({ name: "merchantId", required: true, schema: { type: "string", format: "uuid" } })
  @ApiOkResponse({
    description: "Latest customer LINE messages ordered by createdAt descending",
    type: LatestMessageDto,
    isArray: true,
  })
  async findLatestMessages(@Req() request: Request, @Query("merchantId") merchantId: unknown) {
    // Authenticate first, including requests with missing or malformed query parameters.
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    if (typeof merchantId !== "string") {
      throw new BadRequestException("merchantId must be a UUID");
    }
    const selectedMerchantId = await new ParseUUIDPipe().transform(merchantId, {
      type: "query", data: "merchantId",
    });
    return this.conversationsService.findLatestMessages(user.id, selectedMerchantId);
  }
}
