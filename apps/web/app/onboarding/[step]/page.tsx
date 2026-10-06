import { notFound, redirect } from "next/navigation";
import { LineConnectionSetup } from "../../../components/onboarding/line-connection-setup";
import { AiContextSettingsPage } from "../../../components/onboarding/ai-context-settings";
import { ActivationPage } from "../../../components/onboarding/activation-page";
import { getMerchantAiSettings } from "../../../lib/merchant-ai-settings";
import { getOnboardingStatus, onboardingHref } from "../../../lib/onboarding";
import { publicLineWebhookUrl } from "../../../lib/line-webhook-url";

export default async function SetupStatusPage({ params, searchParams }: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ merchantId?: string; preview?: string }>;
}) {
  const { step } = await params;
  if (step !== "line" && step !== "context" && step !== "activation") notFound();
  const { merchantId } = await searchParams;
  const status = await getOnboardingStatus(merchantId);
  if (step === "activation" && status.complete && status.merchant) {
    redirect(onboardingHref("/dashboard", status.merchant.id));
  }
  const current = status.steps.find((item) => item.id === step);
  const backHref = onboardingHref("/onboarding", status.merchant?.id);
  const canEdit = status.role === "Owner" && !!status.merchant && ["ACTIVE", "TRIAL"].includes(status.merchant.status);
  // A final review can show incomplete Step 5 readiness without completing it.
  // Earlier store/LINE gates still apply: only an accessible Step 5 can lead here.
  const reviewingCurrentContext = step === "activation" && status.steps.find(item => item.id === "context")?.state === "current";
  if (!status.merchant || (current?.state === "pending" && !reviewingCurrentContext)) redirect(backHref);
  if (step === "line") {
    return <LineConnectionSetup backHref={backHref} merchantId={status.merchant.id} merchantName={status.merchant.shopName}
      canEdit={status.role === "Owner" && ["ACTIVE", "TRIAL"].includes(status.merchant.status)}
      webhookUrl={publicLineWebhookUrl(process.env.LINE_PUBLIC_WEBHOOK_URL)} />;
  }
  if (step === "context") {
    return <AiContextSettingsPage key={status.merchant.id} merchantId={status.merchant.id} backHref={backHref}
      nextHref={onboardingHref("/onboarding/activation", status.merchant.id)} canEdit={canEdit}
      initialSettings={await getMerchantAiSettings(status.merchant.id)} />;
  }
  if (step === "activation") {
    return <ActivationPage key={status.merchant.id} canEdit={canEdit} merchantId={status.merchant.id}
      contextHref={onboardingHref("/onboarding/context", status.merchant.id)} />;
  }
  notFound();
}
