"use client";

import { useQuery } from "@tanstack/react-query";

import { getLatestMessages } from "../lib/api";
import type { LiveMessage } from "../types/live-message";

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
