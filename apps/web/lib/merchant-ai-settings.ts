import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { AiSettingsResponse } from "./ai-context-settings";
export async function getMerchantAiSettings(merchantId: string): Promise<AiSettingsResponse> {
  const token = (await cookies()).get("chatto_session")?.value;
  if (!token) redirect("/login");
  const api = (process.env.API_INTERNAL_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
  const response = await fetch(`${api}/merchants/${encodeURIComponent(merchantId)}/ai-settings`, {
    headers: { Cookie: `chatto_session=${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) redirect("/login");
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("ไม่สามารถโหลดการตั้งค่า AI ได้ กรุณาลองใหม่");
  return response.json() as Promise<AiSettingsResponse>;
}
