"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useDashboardSession } from "../app/dashboard/providers";
import { ActivationApiError, readActivation } from "../lib/merchant-activation-api";
import { dashboardReadinessKey } from "../lib/dashboard-model";

export function useDashboardReadiness(merchantId: string | null) {
  const session = useDashboardSession();
  const enabled = !!merchantId && !!session?.active;
  const query = useQuery({
    queryKey: dashboardReadinessKey(session?.userId, merchantId),
    queryFn: async ({ signal }) => {
      const result = await readActivation(merchantId!, signal);
      if (result.merchantId !== merchantId) throw new ActivationApiError(404);
      return result;
    },
    enabled, gcTime: 0, staleTime: 3000, refetchInterval: 15000,
    retry: (count, error) => !(error instanceof ActivationApiError && [401, 403, 404].includes(error.status)) && count < 1,
  });
  const requiresLogin = query.error instanceof ActivationApiError && query.error.status === 401;
  useEffect(() => { if (requiresLogin) session?.suspend(); }, [requiresLogin, session?.suspend]);
  return { readiness: enabled && !query.isError ? query.data : undefined, loading: enabled && query.isLoading,
    error: requiresLogin || !session?.active ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" : query.isError ? "โหลดสถานะร้านไม่สำเร็จ" : null,
    refresh: () => { if (enabled) void query.refetch(); } };
}
