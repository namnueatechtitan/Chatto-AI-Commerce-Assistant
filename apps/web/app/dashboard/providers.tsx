"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const DashboardSession = createContext<{
  userId: string;
  active: boolean;
  suspend: () => void;
  resume: () => void;
} | null>(null);

export function useDashboardSession() {
  return useContext(DashboardSession);
}

interface DashboardProvidersProps {
  children: ReactNode;
  userId: string;
}

export function DashboardProviders({ children, userId }: DashboardProvidersProps) {
  const [active, setActive] = useState(true);
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
  const suspend = useCallback(() => {
    setActive(false);
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);
  const resume = useCallback(() => setActive(true), []);
  useEffect(() => () => { queryClient.clear(); }, [queryClient]);

  return (
    <DashboardSession.Provider value={{ userId, active, suspend, resume }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DashboardSession.Provider>
  );
}
