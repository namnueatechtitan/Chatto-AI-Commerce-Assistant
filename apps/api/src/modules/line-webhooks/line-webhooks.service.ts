/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ flow หลักของการรับ LINE webhook ตั้งแต่ยืนยันความถูกต้องไปจนถึงบันทึกข้อความลงฐานข้อมูล
 */

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

/**
 * หน้าที่: service นี้รับผิดชอบ logic ของ LINE Webhooks
 */
@Injectable()
export class LineWebhooksService {
  private readonly logger = new Logger(LineWebhooksService.name);
  private readonly activeConversationStatuses: ConversationStatus[] = [
    ConversationStatus.AI_ACTIVE,
    ConversationStatus.HANDOVER_REQUESTED,
    ConversationStatus.HUMAN_ACTIVE,
  ];

  /**
   * หน้าที่: ประกอบ dependency ที่คลาสนี้ต้องใช้ระหว่างการทำงาน
   */
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly lineSignatureService: LineSignatureService,
  ) {}

  /**
   * หน้าที่: ประมวลผล LINE webhook ตั้งแต่ตรวจลายเซ็น ตรวจ payload ไปจนถึงบันทึก event และข้อความลงฐานข้อมูล
   */
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

  /**
   * หน้าที่: หา channel LINE ที่ต้องใช้จาก environment และฐานข้อมูลเพื่อผูก webhook กับร้านค้าที่ถูกต้อง
   */
  private async resolveLineChannelContext(): Promise<LineChannelContext> {
    const configuredExternalChannelId = this.configService
      .get<string>("LINE_CHANNEL_ID")
      ?.trim();
    const channelAccessTokenConfigured = Boolean(
      this.configService.get<string>("LINE_CHANNEL_ACCESS_TOKEN")?.trim(),
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

  /**
   * หน้าที่: ประมวลผล event เดี่ยวจาก LINE และสรุปผลว่า event นั้นถูกประมวลผล ถูกละเว้น หรือซ้ำ
   */
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
      return await this.prismaService.$transaction(async (transaction) => {
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

          return "ignored";
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

        await tx.message.create({
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

        return "processed";
      });
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

  /**
   * หน้าที่: ค้นหาลูกค้าจาก external user id ของ LINE หรือสร้างรายการใหม่เมื่อยังไม่มี
   */
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

  /**
   * หน้าที่: ค้นหา conversation ที่ยัง active ของลูกค้าคนนี้ หรือสร้างใหม่เมื่อจำเป็น
   */
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

  /**
   * หน้าที่: ตรวจสอบว่า event ที่รับมาเป็นข้อความ text ที่พร้อมนำไปบันทึกต่อหรือไม่
   */
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

  /**
   * หน้าที่: ตรวจสอบว่า event นี้เป็น event ประเภท message หรือไม่
   */
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

  /**
   * หน้าที่: ตรวจสอบโครงสร้างพื้นฐานของ event ก่อนประมวลผลในขั้นต่อไป
   */
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

  /**
   * หน้าที่: คืนค่า webhook event id จาก payload หรือสร้าง fallback id เมื่อ LINE ไม่ส่งค่ามาให้
   */
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

  /**
   * หน้าที่: จัดรูป payload ดิบให้อยู่ในรูป JSON ที่บันทึกลงฐานข้อมูลได้ง่าย
   */
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

  /**
   * หน้าที่: สร้าง metadata ของข้อความ LINE เพื่อเก็บบริบทที่ใช้สำหรับอ้างอิงและดีบัก
   */
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

  /**
   * หน้าที่: สรุปชนิดของ event ให้อยู่ในรูปข้อความสั้นสำหรับใช้กับ log
   */
  private describeEvent(event: LineWebhookEvent): string {
    if (this.isMessageEvent(event)) {
      return `message:${event.message.type ?? "unknown"}`;
    }

    return event.type;
  }

  /**
   * หน้าที่: ตรวจสอบว่า error ที่เกิดขึ้นเป็น unique constraint error ของ Prisma หรือไม่
   */
  private isKnownUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
    );
  }
}
