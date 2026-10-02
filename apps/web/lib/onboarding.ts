import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { AuthUser } from "./auth";
import type { Merchant, MerchantMembership } from "./merchants";

export type OnboardingStepId = "account" | "session" | "store" | "line" | "context" | "activation";
export interface OnboardingStep {
  id: OnboardingStepId;
  state: "completed" | "current" | "pending";
}
export interface OnboardingStatus {
  user: AuthUser;
  memberships: MerchantMembership[];
  merchant: Merchant | null;
  role: string | null;
  steps: OnboardingStep[];
  completedSteps: number;
  progress: number;
  complete: boolean;
  capabilities: { lineSetup: boolean; contextSetup: boolean; activation: boolean };
}

export const getOnboardingStatus = cache(async (merchantId?: string): Promise<OnboardingStatus> => {
  const token = (await cookies()).get("chatto_session")?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) redirect("/login");
  if (merchantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId)) notFound();
  const apiUrl = (process.env.API_INTERNAL_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
  const query = merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : "";
  const response = await fetch(`${apiUrl}/onboarding/status${query}`, {
    headers: { Cookie: `chatto_session=${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) redirect("/login");
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Unable to load onboarding. Please try again.");
  return response.json() as Promise<OnboardingStatus>;
});

export function onboardingHref(path: string, merchantId?: string | null): string {
  return merchantId ? `${path}?merchantId=${encodeURIComponent(merchantId)}` : path;
}
