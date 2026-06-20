import { Injectable } from "@nestjs/common";
import { MessageType, SenderType } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { LatestMessageDto } from "./dto/latest-message.dto";

@Injectable()
export class ConversationsService {
  private readonly latestMessagesLimit = 20;

  constructor(private readonly prismaService: PrismaService) {}

  async findLatestMessages(): Promise<LatestMessageDto[]> {
    const messages = await this.prismaService.message.findMany({
      where: {
        senderType: SenderType.CUSTOMER,
        messageType: MessageType.TEXT,
        conversation: {
          channel: {
            platform: {
              is: {
                code: {
                  equals: "line",
                  mode: "insensitive",
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: this.latestMessagesLimit,
      select: {
        id: true,
        content: true,
        createdAt: true,
        conversation: {
          select: {
            customer: {
              select: {
                displayName: true,
                externalUserId: true,
                profilePictureUrl: true,
              },
            },
          },
        },
      },
    });

    return messages.map((message: (typeof messages)[number]) => ({
      id: message.id,
      customerName:
        message.conversation.customer.displayName?.trim() ||
        message.conversation.customer.externalUserId ||
        "Customer",
      customerAvatar:
        message.conversation.customer.profilePictureUrl ?? undefined,
      message: message.content,
      timestamp: message.createdAt.toISOString(),
      // TODO: Replace with persisted read-state when that field exists in the schema.
      unread: true,
      channel: "LINE",
    }));
  }
}
