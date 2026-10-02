import { redirect } from "next/navigation";
import { onboardingHref } from "../../../lib/onboarding";
export default async function LegacyStoreInformation({ searchParams }: { searchParams: Promise<{ merchantId?: string }> }) {
  redirect(onboardingHref("/onboarding/store", (await searchParams).merchantId));
}
