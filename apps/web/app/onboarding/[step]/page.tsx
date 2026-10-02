import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OnboardingShell } from "../../../components/onboarding/onboarding-shell";
import { LineConnectionSetup } from "../../../components/onboarding/line-connection-setup";
import { StatusRefresh } from "../../../components/onboarding/status-refresh";
import { stepContent } from "../../../components/onboarding/onboarding-progress";
import { getOnboardingStatus, onboardingHref } from "../../../lib/onboarding";
import { publicLineWebhookUrl } from "../../../lib/line-webhook-url";
import styles from "../onboarding.module.css";

const setupDescriptions = {
  context: "การตั้งค่าบริบท AI ยังไม่เปิดให้ใช้งานบนหน้านี้ ร้านค้าต้องมีข้อมูลสินค้าหรือ FAQ พร้อมใช้งาน และกำหนดชื่อผู้ช่วยกับภาษา ก่อนดำเนินการขั้นตอนถัดไป",
  activation: "การเปิดใช้งาน AI ยังไม่เปิดให้ใช้งานบนหน้านี้ ต้องตรวจสอบความพร้อมและยืนยันการเปิดใช้งานก่อนให้ AI ตอบลูกค้า",
} as const;

export default async function SetupStatusPage({ params, searchParams }: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ merchantId?: string }>;
}) {
  const { step } = await params;
  if (step !== "line" && step !== "context" && step !== "activation") notFound();
  const { merchantId } = await searchParams;
  const status = await getOnboardingStatus(merchantId);
  const current = status.steps.find((item) => item.id === step);
  const backHref = onboardingHref("/onboarding", status.merchant?.id);
  if (!status.merchant || current?.state === "pending") redirect(backHref);
  if (step === "line") {
    return <LineConnectionSetup backHref={backHref} webhookUrl={publicLineWebhookUrl(process.env.LINE_PUBLIC_WEBHOOK_URL)} />;
  }
  return <OnboardingShell user={status.user} role={status.role}>
    <StatusRefresh />
    <section className={styles.setupCard} aria-labelledby="setup-heading">
      <h1 id="setup-heading">{stepContent[step].title}</h1>
      <p>{status.merchant.shopName}</p>
      {current?.state === "completed"
        ? <p>ขั้นตอนนี้เสร็จสิ้นแล้ว</p>
        : <p role="status">{setupDescriptions[step]}</p>}
      <Link className={styles.backLink} href={backHref}>กลับไปยังการตั้งค่า</Link>
    </section>
  </OnboardingShell>;
}
