import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ConversationsService } from "./conversations.service";
import { LatestMessageDto } from "./dto/latest-message.dto";

@ApiTags("conversations")
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get("messages/latest")
  @ApiOperation({ summary: "List latest customer messages for the dashboard feed" })
  @ApiOkResponse({
    description: "Latest customer LINE messages ordered by createdAt descending",
    type: LatestMessageDto,
    isArray: true,
  })
  findLatestMessages() {
    return this.conversationsService.findLatestMessages();
  }
}
