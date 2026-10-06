export interface ActivationCheck { ready: boolean; code: string; title: string }
export interface ActivationReadiness {
  merchantId: string; ready: boolean; aiEnabled: boolean; activatedAt: string | null;
  checks: { store: ActivationCheck; line: ActivationCheck; knowledge: ActivationCheck & { productsCount: number; faqCount: number }; aiContext: ActivationCheck };
  channel: { platform: "LINE"; connected: boolean; displayName: string; channelUuid: string | null };
  aiSummary: { assistantName: string; tone: string; fallbackBehavior: string };
}
export interface ActivationResult { success: true; aiEnabled: boolean; activatedAt: string | null; alreadyEnabled?: boolean; alreadyDisabled?: boolean }
export class ActivationApiError extends Error {
  constructor(public readonly status: number, public readonly notReady = false) {
    super(status === 401 ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"
      : status === 403 ? "เฉพาะ Owner ของร้านเท่านั้นที่เปิดหรือหยุด AI ได้"
      : status === 404 ? "ไม่พบร้านค้าหรือคุณไม่มีสิทธิ์เข้าถึงร้านนี้"
      : notReady ? "ข้อมูลความพร้อมเปลี่ยนแล้ว กรุณาแก้ไขรายการที่ยังไม่ครบก่อนเปิดใช้งาน"
      : "ยังไม่สามารถโหลดหรือเปลี่ยนสถานะ AI ได้ กรุณาลองใหม่");
  }
}
async function request<T>(merchantId: string, suffix: string, init?: RequestInit): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId)) throw new ActivationApiError(404);
  const response = await fetch(`/api/merchants/${encodeURIComponent(merchantId)}/activation${suffix}`, {
    ...init, credentials: "same-origin", cache: "no-store",
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!response.ok) {
    const data: unknown = response.status === 409 ? await response.json().catch(() => null) : null;
    const notReady = !!data && typeof data === "object" && "code" in data && data.code === "MERCHANT_NOT_READY";
    throw new ActivationApiError(response.status, notReady);
  }
  return response.json() as Promise<T>;
}
export const readActivation = (merchantId: string, signal?: AbortSignal) => request<ActivationReadiness>(merchantId, "/readiness", { signal });
export const activateMerchant = (merchantId: string) => request<ActivationResult>(merchantId, "", { method: "POST", body: "{}" });
export const pauseMerchant = (merchantId: string) => request<ActivationResult>(merchantId, "", { method: "DELETE", body: "{}" });
