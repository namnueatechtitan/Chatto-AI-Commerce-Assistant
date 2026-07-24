"use client";

/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ custom hook สำหรับดึงข้อความล่าสุดมาแสดงบน dashboard แบบรีเฟรชเป็นช่วง ๆ
 */


import { useQuery } from "@tanstack/react-query";

import { getLatestMessages } from "../lib/api";
import type { LiveMessage } from "../types/live-message";

/**
 * หน้าที่: hook นี้ดึงข้อความล่าสุดแบบ polling และสรุปสถานะจาก React Query ให้นำไปใช้ใน UI ได้ง่าย
 */
export function useLatestMessages() {
  const query = useQuery<LiveMessage[], Error>({
    queryKey: ["latest-messages"],
    queryFn: getLatestMessages,
    refetchInterval: 5000,
  });

  return {
    error: query.isError ? query.error.message : null,
    isLoading: query.isLoading,
    messages: query.data ?? [],
    refresh: () => {
      void query.refetch();
    },
  };
}
