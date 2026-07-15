import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConversationStatus,
  MessageType,
  Prisma,
  SenderType,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import { AiIntegrationService } from "../ai-integration/ai-integration.service";
import { buildAiChatRequest } from "../ai-integration/ai-chat-request.mapper";
import type { AiChatResponse } from "../ai-integration/ai-contract.types";
import { LineSignatureService } from "./line-signature.service";
import type {
  LineWebhookEvent,
  LineWebhookHandleResult,
  LineWebhookMessageEvent,
  LineWebhookRequestBody,
  LineWebhookTextMessageEvent,
} from "./types/line-webhook.types";

interface LineChannelContext {
  channelId: string;
  merchantId: string;
  channelName: string;
  channelAccessTokenConfigured: boolean;
}

type PrismaTransactionClient = Pick<
  PrismaService,
  "conversation" | "customer" | "lineWebhookEvent" | "message"
>;

type ProcessEventOutcome = "processed" | "ignored" | "duplicate";

interface ProcessedTextMessageContext {
  conversationId: string;
  customerId: string;
  customerDisplayName: string | null;
  messageId: string;
  messageText: string;
  messageTimestamp: Date;
  replyToken: string;
  webhookEventId: string;
}

type TransactionProcessResult =
  | {
      outcome: "processed";
      textMessage: ProcessedTextMessageContext;
    }
  | {
      outcome: "ignored" | "duplicate";
      textMessage?: never;
    };

interface LineReplyResult {
  attempted: boolean;
  delivered: boolean;
  statusCode?: number;
  error?: string;
}

@Injectable()
export class LineWebhooksService {
  private readonly logger = new Logger(LineWebhooksService.name);
  private readonly lineReplyTimeoutMs = this.resolveTimeoutMs(
    "LINE_REPLY_TIMEOUT_MS",
    5000,
  );
  private readonly activeConversationStatuses: ConversationStatus[] = [
    ConversationStatus.AI_ACTIVE,
    ConversationStatus.HANDOVER_REQUESTED,
    ConversationStatus.HUMAN_ACTIVE,
  ];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly lineSignatureService: LineSignatureService,
    private readonly aiIntegrationService: AiIntegrationService,
  ) {}

  async handleWebhook(
    payload: LineWebhookRequestBody,
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): Promise<LineWebhookHandleResult> {
    if (!signature) {
      throw new UnauthorizedException("Missing x-line-signature header");
    }

    if (!rawBody) {
      throw new InternalServerErrorException(
        "Raw request body is unavailable for LINE signature verification",
      );
    }

    if (!this.lineSignatureService.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException("Invalid LINE signature");
    }

    if (!payload || !Array.isArray(payload.events)) {
      throw new BadRequestException("Invalid LINE webhook payload");
    }

    const channelContext = await this.resolveLineChannelContext();
    const result: LineWebhookHandleResult = {
      ok: true,
      receivedEvents: payload.events.length,
      processedEvents: 0,
      ignoredEvents: 0,
      duplicateEvents: 0,
    };

    for (const event of payload.events) {
      const outcome = await this.processEvent(
        channelContext,
        payload.destination,
        event,
      );

      if (outcome === "processed") {
        result.processedEvents += 1;
      } else if (outcome === "duplicate") {
        result.duplicateEvents += 1;
      } else {
        result.ignoredEvents += 1;
      }
    }

    this.logger.log(
      `Handled LINE webhook for channel ${channelContext.channelName}: ` +
        `${result.processedEvents} processed, ` +
        `${result.ignoredEvents} ignored, ` +
        `${result.duplicateEvents} duplicate.`,
    );

    return result;
  }

  private async resolveLineChannelContext(): Promise<LineChannelContext> {
    const configuredExternalChannelId = this.configService
      .get<string>("LINE_CHANNEL_ID")
      ?.trim();
    const configuredLineToken = this.configService
      .get<string>("LINE_CHANNEL_ACCESS_TOKEN")
      ?.trim();
    const channelAccessTokenConfigured = Boolean(
      configuredLineToken &&
        configuredLineToken !== "phase-2-placeholder-token",
    );

    if (configuredExternalChannelId) {
      const configuredChannels = await this.prismaService.channel.findMany({
        where: {
          externalChannelId: configuredExternalChannelId,
          platform: {
            is: {
              code: {
                equals: "line",
                mode: "insensitive",
              },
            },
          },
        },
        include: {
          merchant: true,
          platform: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 2,
      });

      if (configuredChannels.length === 0) {
        throw new ServiceUnavailableException(
          `Configured LINE external channel ID ${configuredExternalChannelId} was not found in the database. ` +
            "Seed merchant/platform/channel records first so channels.external_channel_id matches LINE_CHANNEL_ID. See docs/integrations/line-local-testing.md.",
        );
      }

      if (configuredChannels.length > 1) {
        throw new ServiceUnavailableException(
          `Multiple LINE channels matched external channel ID ${configuredExternalChannelId}. Resolve the duplicate channel data before receiving webhook traffic.`,
        );
      }

      const configuredChannel = configuredChannels[0];

      return {
        channelId: configuredChannel.id,
        merchantId: configuredChannel.merchantId,
        channelName: configuredChannel.channelName,
        channelAccessTokenConfigured,
      };
    }

    const lineChannels = await this.prismaService.channel.findMany({
      where: {
        platform: {
          is: {
            code: {
              equals: "line",
              mode: "insensitive",
            },
          },
        },
      },
      include: {
        merchant: true,
        platform: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 2,
    });

    if (lineChannels.length === 0) {
      throw new ServiceUnavailableException(
        "No LINE channel was found in the database. Create a merchant, a LINE platform record, and a channel record before receiving webhook traffic. " +
          "See docs/integrations/line-local-testing.md.",
      );
    }

    if (lineChannels.length > 1) {
      throw new ServiceUnavailableException(
        "Multiple LINE channels were found. Set LINE_CHANNEL_ID to the LINE Developers external channel ID stored in channels.external_channel_id.",
      );
    }

    return {
      channelId: lineChannels[0].id,
      merchantId: lineChannels[0].merchantId,
      channelName: lineChannels[0].channelName,
      channelAccessTokenConfigured,
    };
  }

  private async processEvent(
    channelContext: LineChannelContext,
    destination: string | undefined,
    event: LineWebhookEvent,
  ): Promise<ProcessEventOutcome> {
    if (!this.hasBasicEventShape(event)) {
      throw new BadRequestException("Invalid LINE webhook event payload");
    }

    const webhookEventId = this.resolveWebhookEventId(event);

    try {
      const transactionResult = await this.prismaService.$transaction(
        async (transaction): Promise<TransactionProcessResult> => {
          const tx = transaction as PrismaTransactionClient;

          await tx.lineWebhookEvent.create({
            data: {
              merchantId: channelContext.merchantId,
              channelId: channelContext.channelId,
              webhookEventId,
              eventType: event.type,
              rawPayload: this.buildRawPayload(destination, event),
            },
          });

          if (!this.isTextMessageEvent(event)) {
            await tx.lineWebhookEvent.update({
              where: {
                webhookEventId,
              },
              data: {
                processedAt: new Date(),
              },
            });

            this.logger.debug(
              `Ignored unsupported LINE webhook event ${webhookEventId} (${this.describeEvent(event)}).`,
            );

            return {
              outcome: "ignored",
            };
          }

          const customer = await this.findOrCreateCustomer(
            tx,
            channelContext,
            event.source.userId,
          );
          const messageTimestamp = new Date(event.timestamp);
          const conversation = await this.findOrCreateActiveConversation(
            tx,
            channelContext,
            customer.id,
            messageTimestamp,
          );

          const customerMessage = await tx.message.create({
            data: {
              merchantId: channelContext.merchantId,
              conversationId: conversation.id,
              senderType: SenderType.CUSTOMER,
              messageType: MessageType.TEXT,
              content: event.message.text,
              externalMessageId: event.message.id,
              metadata: this.buildMessageMetadata(
                destination,
                channelContext.channelAccessTokenConfigured,
                webhookEventId,
                event,
              ),
            },
          });

          await tx.conversation.update({
            where: {
              id: conversation.id,
            },
            data: {
              lastMessageAt: messageTimestamp,
            },
          });

          await tx.lineWebhookEvent.update({
            where: {
              webhookEventId,
            },
            data: {
              processedAt: new Date(),
            },
          });

          return {
            outcome: "processed",
            textMessage: {
              conversationId: conversation.id,
              customerId: customer.id,
              customerDisplayName: customer.displayName,
              messageId: customerMessage.id,
              messageText: event.message.text,
              messageTimestamp,
              replyToken: event.replyToken,
              webhookEventId,
            },
          };
        },
      );

      if (transactionResult.outcome === "processed") {
        void this.respondWithAi(
          channelContext,
          destination,
          transactionResult.textMessage,
        );
      }

      return transactionResult.outcome;
    } catch (error) {
      if (this.isKnownUniqueConstraintError(error)) {
        await this.prismaService.lineWebhookEvent.updateMany({
          where: {
            webhookEventId,
          },
          data: {
            isDuplicate: true,
          },
        });

        this.logger.warn(`Duplicate LINE webhook event skipped: ${webhookEventId}`);
        return "duplicate";
      }

      throw error;
    }
  }

  private async respondWithAi(
    channelContext: LineChannelContext,
    destination: string | undefined,
    textMessage: ProcessedTextMessageContext,
  ): Promise<void> {
    try {
      const aiResponse = await this.aiIntegrationService.chat(
        buildAiChatRequest({
          requestId: `line_${textMessage.webhookEventId}`,
          merchantId: channelContext.merchantId,
          channel: "line",
          conversationId: textMessage.conversationId,
          customerId: textMessage.customerId,
          customerDisplayName: textMessage.customerDisplayName ?? undefined,
          messageId: textMessage.messageId,
          messageText: textMessage.messageText,
          timestamp: textMessage.messageTimestamp.toISOString(),
        }),
      );
      const lineReply = await this.replyToLine(
        textMessage.replyToken,
        aiResponse.reply.text,
      );

      await this.persistAiMessage(
        channelContext,
        destination,
        textMessage,
        aiResponse,
        lineReply,
      );

      this.logger.log(
        `AI reply persisted for LINE webhook ${textMessage.webhookEventId}: provider=${aiResponse.generation?.provider ?? "unknown"}, external=${aiResponse.generation?.used_external_provider ?? false}, lineDelivered=${lineReply.delivered}`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to generate LINE AI reply for webhook ${textMessage.webhookEventId}: ${reason}`,
      );
    }
  }

  private async replyToLine(
    replyToken: string,
    text: string,
  ): Promise<LineReplyResult> {
    const channelAccessToken = this.configService
      .get<string>("LINE_CHANNEL_ACCESS_TOKEN")
      ?.trim();

    if (
      !channelAccessToken ||
      channelAccessToken === "phase-2-placeholder-token"
    ) {
      return {
        attempted: false,
        delivered: false,
        error: "LINE_CHANNEL_ACCESS_TOKEN is not configured",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.lineReplyTimeoutMs,
    );

    try {
      const response = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${channelAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replyToken,
          messages: [
            {
              type: "text",
              text,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        return {
          attempted: true,
          delivered: false,
          statusCode: response.status,
          error: errorText || response.statusText,
        };
      }

      return {
        attempted: true,
        delivered: true,
        statusCode: response.status,
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";

      return {
        attempted: true,
        delivered: false,
        error: timedOut
          ? `LINE reply timed out after ${this.lineReplyTimeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async persistAiMessage(
    channelContext: LineChannelContext,
    destination: string | undefined,
    textMessage: ProcessedTextMessageContext,
    aiResponse: AiChatResponse,
    lineReply: LineReplyResult,
  ): Promise<void> {
    const sentAt = new Date();

    await this.prismaService.message.create({
      data: {
        merchantId: channelContext.merchantId,
        conversationId: textMessage.conversationId,
        senderType: SenderType.AI,
        messageType: MessageType.TEXT,
        content: aiResponse.reply.text,
        metadata: this.buildAiMessageMetadata(
          destination,
          textMessage,
          aiResponse,
          lineReply,
        ),
      },
    });

    await this.prismaService.conversation.update({
      where: {
        id: textMessage.conversationId,
      },
      data: {
        lastMessageAt: sentAt,
      },
    });
  }

  private async findOrCreateCustomer(
    transaction: PrismaTransactionClient,
    channelContext: LineChannelContext,
    externalUserId: string,
  ) {
    const existingCustomer = await transaction.customer.findUnique({
      where: {
        channelId_externalUserId: {
          channelId: channelContext.channelId,
          externalUserId,
        },
      },
    });

    if (existingCustomer) {
      return existingCustomer;
    }

    try {
      return await transaction.customer.create({
        data: {
          merchantId: channelContext.merchantId,
          channelId: channelContext.channelId,
          externalUserId,
        },
      });
    } catch (error) {
      if (this.isKnownUniqueConstraintError(error)) {
        const customer = await transaction.customer.findUnique({
          where: {
            channelId_externalUserId: {
              channelId: channelContext.channelId,
              externalUserId,
            },
          },
        });

        if (customer) {
          return customer;
        }
      }

      throw error;
    }
  }

  private async findOrCreateActiveConversation(
    transaction: PrismaTransactionClient,
    channelContext: LineChannelContext,
    customerId: string,
    messageTimestamp: Date,
  ) {
    const activeConversation = await transaction.conversation.findFirst({
      where: {
        merchantId: channelContext.merchantId,
        customerId,
        channelId: channelContext.channelId,
        status: {
          in: this.activeConversationStatuses,
        },
      },
      orderBy: [
        {
          lastMessageAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    if (activeConversation) {
      return activeConversation;
    }

    return transaction.conversation.create({
      data: {
        merchantId: channelContext.merchantId,
        customerId,
        channelId: channelContext.channelId,
        status: ConversationStatus.AI_ACTIVE,
        lastMessageAt: messageTimestamp,
      },
    });
  }

  private isTextMessageEvent(
    event: LineWebhookEvent,
  ): event is LineWebhookTextMessageEvent {
    if (!this.isMessageEvent(event)) {
      return false;
    }

    return (
      Number.isFinite(event.timestamp) &&
      typeof event.replyToken === "string" &&
      typeof event.source?.userId === "string" &&
      typeof event.message.id === "string" &&
      event.message.type === "text" &&
      typeof event.message.text === "string"
    );
  }

  private isMessageEvent(
    event: LineWebhookEvent,
  ): event is LineWebhookMessageEvent {
    return (
      event.type === "message" &&
      "message" in event &&
      typeof event.message === "object" &&
      event.message !== null
    );
  }

  private hasBasicEventShape(event: LineWebhookEvent): boolean {
    return (
      typeof event === "object" &&
      event !== null &&
      typeof event.type === "string" &&
      Number.isFinite(event.timestamp) &&
      typeof event.source === "object" &&
      event.source !== null &&
      typeof event.source.type === "string"
    );
  }

  private resolveWebhookEventId(event: LineWebhookEvent): string {
    if (typeof event.webhookEventId === "string" && event.webhookEventId.trim()) {
      return event.webhookEventId.trim();
    }

    const fallbackSource = {
      messageId:
        this.isMessageEvent(event) && typeof event.message.id === "string"
          ? event.message.id
          : null,
      sourceType: event.source?.type ?? null,
      sourceUserId:
        typeof event.source?.userId === "string" ? event.source.userId : null,
      timestamp: event.timestamp,
      type: event.type,
    };

    const digest = createHash("sha256")
      .update(JSON.stringify(fallbackSource))
      .digest("hex");

    return `fallback_${digest}`;
  }

  private buildRawPayload(
    destination: string | undefined,
    event: LineWebhookEvent,
  ): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify({
        destination: destination ?? null,
        event,
      }),
    ) as Prisma.InputJsonValue;
  }

  private buildMessageMetadata(
    destination: string | undefined,
    channelAccessTokenConfigured: boolean,
    webhookEventId: string,
    event: LineWebhookTextMessageEvent,
  ): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify({
        line: {
          destination: destination ?? null,
          replyToken: event.replyToken,
          sourceType: event.source.type,
          timestamp: event.timestamp,
          webhookEventId,
          deliveryContext: event.deliveryContext ?? null,
          mode: event.mode ?? null,
          channelAccessTokenConfigured,
        },
      }),
    ) as Prisma.InputJsonValue;
  }

  private buildAiMessageMetadata(
    destination: string | undefined,
    textMessage: ProcessedTextMessageContext,
    aiResponse: AiChatResponse,
    lineReply: LineReplyResult,
  ): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify({
        ai: {
          requestId: aiResponse.request_id,
          intent: aiResponse.intent,
          confidence: aiResponse.reply.confidence,
          sources: aiResponse.sources ?? [],
          actions: aiResponse.actions ?? [],
          handoverRequired: aiResponse.handover_required,
          generation: aiResponse.generation ?? null,
          mcp: "mcp" in aiResponse ? aiResponse.mcp : null,
        },
        line: {
          destination: destination ?? null,
          replyToken: textMessage.replyToken,
          sourceWebhookEventId: textMessage.webhookEventId,
          reply: lineReply,
        },
      }),
    ) as Prisma.InputJsonValue;
  }

  private resolveTimeoutMs(name: string, fallback: number): number {
    const configured = Number(process.env[name]);

    if (Number.isFinite(configured) && configured >= 1000) {
      return configured;
    }

    return fallback;
  }

  private describeEvent(event: LineWebhookEvent): string {
    if (this.isMessageEvent(event)) {
      return `message:${event.message.type ?? "unknown"}`;
    }

    return event.type;
  }

  private isKnownUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
    );
  }
}
