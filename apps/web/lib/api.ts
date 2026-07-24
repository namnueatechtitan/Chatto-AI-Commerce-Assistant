/**
 * หน้าที่ไฟล์: ไฟล์นี้รวม helper สำหรับเรียก API จากฝั่งเว็บและซ่อนรายละเอียดการต่อ base URL ไว้จุดเดียว
 */

import type { LiveMessage } from "../types/live-message";

const DEFAULT_API_BASE_URL = "http://localhost:4000";

/**
 * หน้าที่: คืนค่า base URL ของ API จาก environment หรือค่าเริ่มต้น พร้อมตัดเครื่องหมาย / ด้านท้ายออกก่อนนำไปต่อ path
 */
function getApiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

  return baseUrl.replace(/\/+$/, "");
}

/**
 * หน้าที่: เรียก API และแปลงผลลัพธ์กลับมาเป็น JSON พร้อมโยน error เมื่อสถานะคำขอล้มเหลว
 */
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * หน้าที่: ดึงรายการข้อความล่าสุดจาก API สำหรับใช้ใน live messages feed บน dashboard
 */
export function getLatestMessages() {
  return fetchJson<LiveMessage[]>("/conversations/messages/latest");
}
