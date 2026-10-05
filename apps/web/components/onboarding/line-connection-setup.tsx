import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OnboardingBranding } from "./onboarding-branding";
import { LineConnectionForm } from "./line-connection-form";
import base from "../../app/onboarding/onboarding.module.css";
import styles from "./line-connection.module.css";

export function LineConnectionSetup({ backHref, webhookUrl, merchantId, merchantName, canEdit }: {
  backHref: string; webhookUrl: string | null; merchantId: string; merchantName: string; canEdit: boolean;
}) {
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
          <p className={styles.merchantName}>ร้าน: {merchantName}</p>
          <p>บันทึกข้อมูล LINE OA ของร้าน แล้วคัดลอก Webhook URL ไป Verify ใน LINE Developers Console</p>
        </header>
        <LineConnectionForm key={merchantId} skipHref={backHref} webhookPrefix={webhookUrl} merchantId={merchantId} canEdit={canEdit} />
      </section>
    </main>
  );
}
