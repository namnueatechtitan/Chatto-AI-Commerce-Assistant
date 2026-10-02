import { OnboardingShell } from "../../components/onboarding/onboarding-shell";
import styles from "./onboarding.module.css";

export default function Loading() {
  return <OnboardingShell>
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.skeletonHeading} aria-hidden="true" />
      <p>กำลังโหลดข้อมูลบัญชีและความคืบหน้า…</p>
      <div className={styles.skeletonCard} aria-hidden="true" />
    </div>
  </OnboardingShell>;
}
