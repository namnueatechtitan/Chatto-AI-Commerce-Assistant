/**
 * หน้าที่ไฟล์: ไฟล์นี้รวม enum และ interface กลางที่หลายแอปใน monorepo ใช้ร่วมกัน
 */

export type UserRole = "owner" | "admin" | "manager" | "support_agent" | "viewer";

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  DELETED = "deleted",
}

export enum MerchantStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  TRIAL = "trial",
}

export enum ChannelStatus {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  INVALID_TOKEN = "invalid_token",
  DISABLED = "disabled",
}

export enum ProductStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

export enum DocumentStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
  OUTDATED = "outdated",
}

export enum ConversationStatus {
  AI_ACTIVE = "ai_active",
  HANDOVER_REQUESTED = "handover_requested",
  HUMAN_ACTIVE = "human_active",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

export enum SenderType {
  CUSTOMER = "customer",
  AI = "ai",
  HUMAN_AGENT = "human_agent",
  SYSTEM = "system",
}

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  STICKER = "sticker",
  PRODUCT_CARD = "product_card",
  ORDER_SUMMARY = "order_summary",
  PAYMENT_QR = "payment_qr",
  SYSTEM_EVENT = "system_event",
}

export enum TicketStatus {
  OPEN = "open",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

export enum TicketPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum AiActionStatus {
  PROPOSED = "proposed",
  VALIDATED = "validated",
  REJECTED = "rejected",
  EXECUTED = "executed",
  HUMAN_REVIEW_REQUIRED = "human_review_required",
  FAILED = "failed",
}

export enum GuardrailSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

export interface User extends BaseEntity {
  name: string;
  email: string;
  globalRole: string;
  status: UserStatus;
}

export interface Merchant extends BaseEntity {
  shopName: string;
  slug: string;
  businessCategory: string | null;
  status: MerchantStatus;
}

export interface Product extends BaseEntity {
  merchantId: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  status: ProductStatus;
}

export interface ProductVariant extends BaseEntity {
  merchantId: string;
  productId: string;
  variantName: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  price: string | null;
  currency: string | null;
  stockOnHand: number | null;
  stockReserved: number | null;
  lowStockThreshold: number | null;
  status: ProductStatus;
}

export interface Customer extends BaseEntity {
  merchantId: string;
  channelId: string;
  externalUserId: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  profilePictureUrl: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
}

export interface Conversation extends BaseEntity {
  merchantId: string;
  customerId: string;
  channelId: string;
  status: ConversationStatus;
  ownerType: string | null;
  assignedStaffId: string | null;
  lastMessageAt: string | null;
}

export interface Message extends BaseEntity {
  merchantId: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string | null;
  messageType: MessageType;
  content: string;
  metadata?: Record<string, unknown> | null;
  externalMessageId?: string | null;
}

export interface AiResponse {
  intent: string;
  confidence: number;
  reply: string;
  needs_handover: boolean;
  suggested_action: string | null;
}

export interface HandoverTicket extends BaseEntity {
  merchantId: string;
  conversationId: string;
  customerId: string;
  status: TicketStatus;
  priority: TicketPriority;
  reason: string;
  aiSummary: string | null;
  assignedMerchantUserId: string | null;
  assignedChattoAdminId: string | null;
}
