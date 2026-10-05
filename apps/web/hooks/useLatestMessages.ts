"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { ApiError, getLatestMessages } from "../lib/api";
import { useDashboardSession } from "../app/dashboard/providers";
import type { LiveMessage } from "../types/live-message";

export function useLatestMessages(merchantId: string | null) {
  const session = useDashboardSession();
  const queryClient = useQueryClient();
  const userId = session?.userId;
  const enabled = Boolean(session?.active && merchantId);
  const query = useQuery<LiveMessage[], Error>({
    queryKey: ["latest-messages", userId, merchantId],
    queryFn: ({ signal }) => getLatestMessages(merchantId!, signal),
    enabled,
    gcTime: 0,
    retry: (count, error) => !(error instanceof ApiError && [400, 401, 404].includes(error.status)) && count < 1,
    refetchInterval: 5000,
  });
  useEffect(() => () => {
    const queryKey = ["latest-messages", userId, merchantId];
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.removeQueries({ queryKey, exact: true });
  }, [queryClient, userId, merchantId]);
  const unauthorized = query.error instanceof ApiError && query.error.status === 401;
  useEffect(() => {
    if (unauthorized) session?.suspend();
  }, [unauthorized, session?.suspend]);

  return {
    error: session && !session.active ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" : query.isError ? query.error.message : null,
    requiresLogin: unauthorized || Boolean(session && !session.active),
    isLoading: enabled && query.isLoading,
    messages: enabled && !query.isError ? query.data ?? [] : [],
    refresh: () => {
      if (enabled) void query.refetch();
    },
  };
}
