"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivationApiError, activateMerchant, pauseMerchant, readActivation, type ActivationReadiness } from "../lib/merchant-activation-api";
import { useDashboardSession } from "../app/dashboard/providers";

export function useMerchantActivation(merchantId: string) {
  const session = useDashboardSession();
  const [readiness, setReadiness] = useState<ActivationReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const result = await readActivation(merchantId, signal);
      if (result.merchantId !== merchantId) throw new ActivationApiError(404);
      if (current === sequence.current && !signal?.aborted) { setReadiness(result); setError(null); }
      return result;
    } catch (failure) {
      if (current === sequence.current && !signal?.aborted) { setReadiness(null); setError(failure instanceof ActivationApiError ? failure.message : "โหลดสถานะ AI ไม่สำเร็จ กรุณาลองใหม่"); }
      return null;
    } finally { if (current === sequence.current && !signal?.aborted) setLoading(false); }
  }, [merchantId]);
  useEffect(() => { const controller = new AbortController(); setReadiness(null); void refresh(controller.signal); return () => { controller.abort(); sequence.current++; }; }, [refresh]);
  const change = async (enabled: boolean, options: { refreshAfter?: boolean } = {}) => {
    if (busy.current) return false;
    busy.current = true; setPending(true); setError(null);
    try {
      const result = await (enabled ? activateMerchant(merchantId) : pauseMerchant(merchantId));
      if (result.success !== true || result.aiEnabled !== enabled) throw new ActivationApiError(503);
      session?.refreshActivation(merchantId);
      // Step 6 navigates using the confirmed mutation response. Its destination
      // reads fresh status; a second GET here must not hold up that navigation.
      if (options.refreshAfter !== false) await refresh();
      return true;
    } catch (failure) {
      if (failure instanceof ActivationApiError && failure.notReady) await refresh();
      setError(failure instanceof ActivationApiError ? failure.message : "เปลี่ยนสถานะ AI ไม่สำเร็จ กรุณาลองใหม่");
      return false;
    } finally { busy.current = false; setPending(false); }
  };
  return { readiness, loading, pending, error, refresh, change };
}
