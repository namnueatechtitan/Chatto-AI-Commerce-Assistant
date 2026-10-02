"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./onboarding.module.css";

export default function OnboardingError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return <main className={styles.errorPage}>
    <div className={styles.setupCard} role="alert">
      <h1>ไม่สามารถโหลดข้อมูลการตั้งค่าได้</h1>
      <p>กรุณาลองอีกครั้งเมื่อเชื่อมต่อได้ ข้อมูลความคืบหน้าของคุณยังคงอยู่</p>
      <button className={styles.primaryButton} type="button" disabled={pending} onClick={retry}>{pending ? "กำลังโหลด…" : "ลองอีกครั้ง"}</button>
      <Link className={styles.backLink} href="/login">กลับไปเข้าสู่ระบบ</Link>
    </div>
  </main>;
}
