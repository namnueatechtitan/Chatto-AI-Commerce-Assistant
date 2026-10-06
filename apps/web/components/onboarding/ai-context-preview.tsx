import Link from "next/link";
import type { AiSettingsResponse } from "../../lib/ai-context-settings";
import base from "../../app/onboarding/onboarding.module.css";
import styles from "./ai-context.module.css";

// Read-only saved state. Activation remains the existing separate lifecycle.
export function AiContextPreview({ settings, merchantName, contextHref, backHref }: {
  settings: AiSettingsResponse; merchantName: string; contextHref: string; backHref: string;
}) {
  return <section className={base.setupCard} aria-labelledby="setup-heading">
    <span className={styles.previewBadge}>ขั้นตอนที่ 6 จาก 6</span>
    <h1 id="setup-heading">เปิดใช้งานจริง</h1>
    <p>{merchantName}</p>
    <p role="status">การตั้งค่า AI บันทึกในระบบแล้ว การยืนยันเปิดใช้งานยังเป็นขั้นตอนแยกต่างหาก</p>
    <dl className={styles.previewSummary}>
      <div><dt>ชื่อ AI</dt><dd>{settings.assistantName}</dd></div>
      <div><dt>ภาษาหลัก</dt><dd>{settings.language === "th" ? "ภาษาไทย" : "English"}</dd></div>
      <div><dt>ความสามารถที่เลือก</dt><dd>{Object.values(settings.capabilities).filter(Boolean).length} จาก 8</dd></div>
      <div><dt>กฎของร้าน</dt><dd>{settings.rules.length} ข้อ</dd></div>
    </dl>
    <Link className={base.backLink} href={contextHref}>กลับไปแก้ไขบริบท AI</Link>
    <Link className={base.backLink} href={backHref}>กลับไปยังการตั้งค่า</Link>
  </section>;
}
