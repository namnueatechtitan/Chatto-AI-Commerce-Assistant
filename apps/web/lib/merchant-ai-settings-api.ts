import type { AiContextPayload, AiSettingsResponse } from "./ai-context-settings";
export async function saveMerchantAiSettings(merchantId: string, payload: AiContextPayload): Promise<AiSettingsResponse> {
  const response = await fetch(`/api/merchants/${encodeURIComponent(merchantId)}/ai-settings`, {
    method: "PATCH", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(response.status === 401 ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"
    : response.status === 403 || response.status === 404 ? "ไม่มีสิทธิ์แก้ไขการตั้งค่า AI ของร้านนี้"
    : response.status === 400 ? "ตรวจสอบข้อมูลและกฎของร้าน แล้วลองบันทึกอีกครั้ง"
    : "ยังบันทึกการตั้งค่า AI ไม่สำเร็จ กรุณาลองใหม่");
  return response.json() as Promise<AiSettingsResponse>;
}
