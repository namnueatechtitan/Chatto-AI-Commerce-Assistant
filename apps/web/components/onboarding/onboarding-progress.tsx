import Link from "next/link";
import { Check } from "lucide-react";
import type { OnboardingStep, OnboardingStepId } from "../../lib/onboarding";
import styles from "../../app/onboarding/onboarding.module.css";

export const stepContent: Record<OnboardingStepId, { title: string; description: string; path?: string }> = {
  account: { title: "สมัครสมาชิก", description: "สร้างบัญชีเรียบร้อยแล้ว" },
  session: { title: "เข้าสู่ระบบ", description: "ยืนยันตัวตนเรียบร้อยแล้ว" },
  store: { title: "เพิ่มข้อมูลร้านค้า", description: "เพิ่มข้อมูลพื้นฐานร้าน คำถามที่พบบ่อย และแคตตาล็อก", path: "/onboarding/store" },
  line: { title: "เชื่อมต่อ LINE OA", description: "เชื่อมต่อ LINE Official Account ของร้านค้า", path: "/onboarding/line" },
  context: { title: "ตั้งค่าบริบท AI", description: "เพิ่มข้อมูลร้านค้า สินค้าหรือ FAQ และกำหนดการทำงานของ AI", path: "/onboarding/context" },
  activation: { title: "เปิดใช้งานจริง", description: "ตรวจสอบความพร้อมและเปิดให้ AI ตอบลูกค้า", path: "/onboarding/activation" },
};

export function OnboardingProgress({ progress, completedSteps }: { progress: number; completedSteps: number }) {
  return <div className={styles.progressSection}>
    <h2 id="progress-title" className={styles.progressTitle}>ความคืบหน้าในการตั้งค่าร้านค้า</h2>
    <div className={styles.progressTrack} role="progressbar" aria-labelledby="progress-title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`เสร็จสิ้น ${completedSteps} จาก 6 ขั้นตอน (${progress}%)`}>
      <span className={styles.progressFill} style={{ width: `${progress}%` }}>{progress}%</span>
    </div>
  </div>;
}

export function OnboardingStepItem({ step, index, merchantId }: { step: OnboardingStep; index: number; merchantId?: string }) {
  const { title, description, path } = stepContent[step.id];
  const href = path && merchantId ? `${path}?merchantId=${encodeURIComponent(merchantId)}` : path;
  return <li className={`${styles.step} ${styles[step.state]}`} aria-current={step.state === "current" ? "step" : undefined}>
    <span className={styles.stepIndicator} aria-hidden="true">
      {step.state === "completed" ? <Check size={22} strokeWidth={3} /> : index + 1}
    </span>
    <div className={styles.stepCopy}>
      <h3>{step.id === "store" && step.state === "completed" && href ? <Link href={href} style={{ color: "inherit", textDecoration: "none" }} aria-label="แก้ไขข้อมูลร้านค้า">{title}</Link> : title}</h3>
      <p>{description}</p>
    </div>
    {step.state === "current" && href
      ? <Link className={`${styles.statusBadge} ${styles.stepAction}`} href={href} aria-label={`เริ่มการตั้งค่า: ${title}`}>เริ่มการตั้งค่า</Link>
      : <span className={styles.statusBadge}>{step.state === "completed" ? "เสร็จสิ้น" : "รอการตั้งค่า"}</span>}
  </li>;
}
