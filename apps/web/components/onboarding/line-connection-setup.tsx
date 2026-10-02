import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OnboardingBranding } from "./onboarding-branding";
import { LineConnectionForm } from "./line-connection-form";
import base from "../../app/onboarding/onboarding.module.css";
import styles from "./line-connection.module.css";

export function LineConnectionSetup({ backHref, webhookUrl }: { backHref: string; webhookUrl: string | null }) {
  return (
    <main className={`${base.page} ${styles.page}`}>
      <OnboardingBranding />
      <section className={styles.panel} aria-labelledby="line-setup-heading">
        <Link className={styles.back} href={backHref}>
          <ArrowLeft size={15} aria-hidden="true" />กลับไปยังการตั้งค่า
        </Link>
        <span className={styles.badge}>ขั้นตอนที่ 4 จาก 6</span>
        <header className={styles.intro}>
          <h1 id="line-setup-heading">เชื่อมต่อ LINE OA</h1>
          <p>เชื่อมต่อ LINE Official Account ของร้านคุณ เพื่อให้ Chatto AI เริ่มตอบแชทลูกค้าอัตโนมัติได้ทันที</p>
        </header>
        <div className={styles.connectionStatus}>
          <span className={styles.statusDot} aria-hidden="true" />
          <div>
            <p>ยังไม่ได้เชื่อมต่อ</p>
            <p>กรอกข้อมูลด้านล่างเพื่อเตรียมเชื่อมต่อบัญชี LINE OA ของคุณ</p>
          </div>
        </div>
        <LineConnectionForm skipHref={backHref} webhookUrl={webhookUrl} />
      </section>
    </main>
  );
}
