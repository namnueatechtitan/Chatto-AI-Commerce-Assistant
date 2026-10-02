import { redirect } from "next/navigation";
import { OnboardingShell } from "../../components/onboarding/onboarding-shell";
import { OnboardingProgress, OnboardingStepItem } from "../../components/onboarding/onboarding-progress";
import { StatusRefresh } from "../../components/onboarding/status-refresh";
import { getOnboardingStatus } from "../../lib/onboarding";
import { getUserDisplayName } from "../../lib/user-display";
import styles from "./onboarding.module.css";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ merchantId?: string; saved?: string }> }) {
  const { merchantId, saved } = await searchParams;
  const status = await getOnboardingStatus(merchantId);
  if (status.complete) redirect(status.merchant ? `/dashboard?merchantId=${status.merchant.id}` : "/dashboard");
  const name = getUserDisplayName(status.user);
  return <OnboardingShell user={status.user} role={status.role}>
    <StatusRefresh />
    <div className={styles.welcome}>
      <span className={styles.wave} aria-hidden="true">👋</span>
      <h1><span>Welcome,</span><span className={styles.welcomeName}>{name} <span className={styles.exclamation}>!</span></span></h1>
    </div>
    <p className={styles.welcomeDescription}>อีกเพียงไม่กี่ขั้นตอน AI ก็พร้อมช่วยตอบลูกค้า และเพิ่มยอดขายให้ร้านของคุณแล้ว</p>
    {status.memberships.length > 1 && <form className={styles.storeSelector} action="/onboarding" method="get">
      <label htmlFor="selected-merchant">ร้านค้า</label>
      <select id="selected-merchant" name="merchantId" defaultValue={status.merchant?.id || ""} required>
        <option value="" disabled>เลือกร้านค้า</option>
        {status.memberships.map(({ merchant }) => <option key={merchant.id} value={merchant.id}>{merchant.shopName}</option>)}
      </select>
      <button className={styles.secondaryButton} type="submit">เลือกร้านค้า</button>
    </form>}
    {saved === "store" && status.steps[2].state === "completed" && <p role="status" className={styles.availabilityNotice}>ข้อมูลร้านพร้อมแล้ว ไปต่อที่การเชื่อมต่อ LINE OA ได้เลย</p>}
    <OnboardingProgress progress={status.progress} completedSteps={status.completedSteps} />
    <div className={styles.stepsCard}>
      <ol className={styles.steps} aria-label="ขั้นตอนการตั้งค่าร้านค้า">
        {status.steps.map((step, index) => <OnboardingStepItem key={step.id} step={step} index={index} merchantId={status.merchant?.id} />)}
      </ol>
    </div>
  </OnboardingShell>;
}
