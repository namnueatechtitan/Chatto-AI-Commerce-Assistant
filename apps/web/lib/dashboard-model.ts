import type { MerchantMembership } from "./merchants";
import type { LiveMessage } from "../types/live-message";

export type ConversationOwnership = "AI" | "WAITING_HANDOVER" | "HUMAN";
export interface DashboardConversation extends LiveMessage {
  ownership?: ConversationOwnership;
  previewReplies?: { text: string; timestamp: string }[];
}
export function dashboardMembership(memberships: MerchantMembership[], merchantId: string | null) {
  return merchantId !== null ? memberships.find(item => item.merchant.id === merchantId) ?? null
    : memberships.length === 1 ? memberships[0] : null;
}
export const dashboardReadinessKey = (userId: string | undefined, merchantId: string | null) =>
  ["dashboard-readiness", userId, merchantId] as const;
export function filterDashboardMessages(messages: DashboardConversation[], search: string, waitingOnly: boolean) {
  const term = search.trim().toLocaleLowerCase("th-TH");
  return messages.filter(message => (!waitingOnly || message.ownership === "WAITING_HANDOVER")
    && (!term || `${message.customerName} ${message.message}`.toLocaleLowerCase("th-TH").includes(term)));
}
export function dashboardTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
}
