import type { LiveMessage } from "../types/live-message";

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(status === 400 ? "กรุณาเลือกร้านค้าให้ถูกต้อง"
      : status === 401 ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"
      : status === 404 ? "ไม่พบร้านค้าหรือคุณไม่มีสิทธิ์ดูข้อความของร้านนี้"
      : "ไม่สามารถโหลดข้อความได้ กรุณาลองใหม่อีกครั้ง");
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return response.json() as Promise<T>;
}

export function getLatestMessages(merchantId: string, signal?: AbortSignal) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId)) {
    return Promise.reject(new ApiError(400));
  }
  return fetchJson<LiveMessage[]>(`/api/conversations/messages/latest?merchantId=${encodeURIComponent(merchantId)}`, { signal });
}
