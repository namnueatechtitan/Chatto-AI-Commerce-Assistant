"use client";

/**
 * หน้าที่ไฟล์: ไฟล์นี้รวม provider ที่หน้ากลุ่ม dashboard ต้องใช้ เช่น state และ data fetching layer
 */


import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

interface DashboardProvidersProps {
  children: ReactNode;
}

/**
 * หน้าที่: คอมโพเนนต์นี้ห่อ children ด้วย provider ที่ส่วนนี้ของระบบต้องใช้
 */
export function DashboardProviders({ children }: DashboardProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
