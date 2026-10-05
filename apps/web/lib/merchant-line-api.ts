export interface LineChannelMetadata {
  id: string;
  externalChannelId: string | null;
  status: "CONFIGURED" | "CREDENTIALS_VERIFIED" | "WEBHOOK_PENDING" | "CONNECTED" | "ERROR" | "DISCONNECTED" | "DISABLED";
  isConnected: boolean;
  hasCredentials: boolean;
  revision: number;
  credentialsVerifiedAt: string | null;
  webhookVerifiedAt: string | null;
  issue: string | null;
}
export interface LineConfiguration { current: LineChannelMetadata | null; history: LineChannelMetadata[] }
type LineConflict = "ASSOCIATION_UNAVAILABLE" | "CHANNEL_CHANGE_REQUIRES_DISCONNECT" | "CREDENTIALS_REQUIRED";
export class LineApiError extends Error {
  constructor(public readonly status: number, reason?: LineConflict) {
    super(status === 401 ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"
      : status === 403 ? "คุณไม่มีสิทธิ์แก้ไขการเชื่อมต่อ LINE OA กรุณาติดต่อ Owner"
      : status === 404 ? "ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึงร้านค้านี้"
      : status === 409 && reason === "ASSOCIATION_UNAVAILABLE" ? "LINE OA นี้เชื่อมกับร้านอื่นอยู่แล้ว ไม่สามารถบันทึกให้ร้านนี้ได้ กรุณาเปิดหน้าของร้านที่เชื่อมไว้"
      : status === 409 && reason === "CHANNEL_CHANGE_REQUIRES_DISCONNECT" ? "ร้านนี้มี LINE OA อื่นเชื่อมอยู่แล้ว ต้องยกเลิกการเชื่อมต่อเดิมก่อนเปลี่ยน OA"
      : status === 409 && reason === "CREDENTIALS_REQUIRED" ? "กรุณาบันทึกข้อมูล LINE ก่อนตรวจสอบการเชื่อมต่อ"
      : status === 409 ? "ข้อมูลการเชื่อมต่อเปลี่ยนแล้ว กรุณาโหลดสถานะใหม่ก่อนลองอีกครั้ง"
      : status === 400 ? "ตรวจสอบ Channel ID, Channel Secret และ Channel Access Token แล้วลองอีกครั้ง"
      : "ยังไม่สามารถดำเนินการได้ กรุณาตรวจสอบการเปิดใช้งาน Backend แล้วลองอีกครั้ง");
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function request<T>(merchantId: string, suffix = "", init?: RequestInit): Promise<T> {
  if (!uuid.test(merchantId)) throw new LineApiError(400);
  const response = await fetch(`/api/merchants/${encodeURIComponent(merchantId)}/line-channel${suffix}`, {
    ...init, credentials: "same-origin", cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(30000),
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!response.ok) {
    let reason: LineConflict | undefined;
    if (response.status === 409) {
      // Recognize only these fixed backend messages; never echo an arbitrary response body.
      const data: unknown = await response.json().catch(() => null);
      const message = data && typeof data === "object" && "message" in data ? data.message : null;
      if (message === "LINE association is unavailable") reason = "ASSOCIATION_UNAVAILABLE";
      else if (message === "Disconnect the current LINE channel before configuring another") reason = "CHANNEL_CHANGE_REQUIRES_DISCONNECT";
      else if (message === "Configure LINE credentials before verification") reason = "CREDENTIALS_REQUIRED";
    }
    throw new LineApiError(response.status, reason);
  }
  return response.json() as Promise<T>;
}
export const readLineConfiguration = (merchantId: string, signal?: AbortSignal) => request<LineConfiguration>(merchantId, "", { signal });
export const configureLine = (merchantId: string, input: { externalChannelId?: string; channelSecret?: string; channelAccessToken?: string; expectedRevision: number }) =>
  request<LineChannelMetadata>(merchantId, "", { method: "PUT", body: JSON.stringify(input) });
export function changeLine(merchantId: string, channel: LineChannelMetadata, action: "verify" | "disconnect") {
  if (!uuid.test(channel.id)) return Promise.reject(new LineApiError(400));
  return request<LineChannelMetadata>(merchantId, `/${encodeURIComponent(channel.id)}/${action}`, {
    method: "POST", body: JSON.stringify({ expectedRevision: channel.revision }),
  });
}
export function lineConnected(channel: LineChannelMetadata | null): boolean {
  return Boolean(channel?.status === "CONNECTED" && channel.isConnected && channel.hasCredentials &&
    channel.credentialsVerifiedAt && channel.webhookVerifiedAt);
}
export function lineWebhookReady(channel: LineChannelMetadata | null): boolean {
  return lineConnected(channel) || Boolean(channel?.status === "WEBHOOK_PENDING" &&
    channel.hasCredentials && channel.credentialsVerifiedAt);
}
export function lineWebhookCopyable(channel: LineChannelMetadata | null): boolean {
  return Boolean(channel && uuid.test(channel.id) && lineWebhookReady(channel));
}
