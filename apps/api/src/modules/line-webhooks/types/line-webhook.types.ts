/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ type ที่ใช้แทน payload และผลลัพธ์ของ LINE webhook ในระบบ API
 */

export interface LineWebhookRequestBody {
  destination?: string;
  events: LineWebhookEvent[];
}

export interface LineWebhookDeliveryContext {
  isRedelivery?: boolean;
}

export interface LineWebhookEventSource {
  type: string;
  userId?: string;
  groupId?: string;
  roomId?: string;
}

export interface LineWebhookEventBase {
  type: string;
  timestamp: number;
  source: LineWebhookEventSource;
  replyToken?: string;
  mode?: string;
  webhookEventId?: string;
  deliveryContext?: LineWebhookDeliveryContext;
  [key: string]: unknown;
}

export interface LineWebhookMessage {
  id?: string;
  type?: string;
  text?: string;
  [key: string]: unknown;
}

export interface LineWebhookMessageEvent extends LineWebhookEventBase {
  type: "message";
  message: LineWebhookMessage;
}

export interface LineWebhookTextMessageEvent extends LineWebhookMessageEvent {
  replyToken: string;
  source: LineWebhookEventSource & {
    userId: string;
  };
  message: {
    id: string;
    type: "text";
    text: string;
  };
}

export type LineWebhookEvent =
  | LineWebhookMessageEvent
  | LineWebhookEventBase;

export interface LineWebhookHandleResult {
  ok: true;
  receivedEvents: number;
  processedEvents: number;
  ignoredEvents: number;
  duplicateEvents: number;
}
