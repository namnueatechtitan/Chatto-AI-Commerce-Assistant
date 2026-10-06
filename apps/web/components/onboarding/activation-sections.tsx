import type { ReactNode } from "react";
import { Check, ShieldCheck } from "lucide-react";
import type { ActiveChannel, AiSummary, ReadinessStatus } from "../../lib/activation-view-model";
import { Card } from "../ui/Card";
import styles from "./activation.module.css";

function ActivationCard({ number, title, description, children }: {
  number: number; title: string; description?: string; children: ReactNode;
}) {
  const headingId = `activation-section-${number}`;
  return <Card className={styles.card} aria-labelledby={headingId}>
    <header className={styles.sectionHeader}>
      <span className={styles.number} aria-hidden="true">{number}</span>
      <div><h2 id={headingId}>{title}</h2>{description && <p>{description}</p>}</div>
    </header>
    {children}
  </Card>;
}

export function ReadinessItem({ item }: { item: ReadinessStatus }) {
  return <li className={styles.readinessItem}>
    <span className={`${styles.indicator} ${item.ready ? styles.ready : styles.incomplete}`} aria-hidden="true">
      {item.ready ? <Check /> : "!"}
    </span>
    <div className={styles.rowCopy}><h3>{item.title}</h3><p>{item.description}</p></div>
    <span className={`${styles.statusBadge} ${!item.ready ? styles.warningBadge : ""}`}>{item.ready ? "ครบถ้วน" : "ยังไม่ครบ"}</span>
  </li>;
}

export function ReadinessCard({ items }: { items: ReadinessStatus[] }) {
  return <ActivationCard number={1} title="ตรวจสอบความพร้อม" description="ตรวจสอบข้อมูลที่จำเป็นก่อนเริ่มใช้งาน">
    <ul className={styles.readinessList}>{items.map(item => <ReadinessItem key={item.id} item={item} />)}</ul>
  </ActivationCard>;
}

// Reuses the same LINE mark used by the existing login form; no new asset/library.
function LineMark() {
  return <span className={styles.lineIcon} aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false">
    <path fill="white" d="M16 3C8.3 3 2 8.1 2 14.3c0 5.6 5 10.2 11.7 11.1.5.1.8.3.8.7l-.3 2.1c-.1.6.3.8.8.5 2-1 6.8-4.1 9.4-6.9 3.7-3.3 5.6-5.5 5.6-9C30 7.5 23.7 3 16 3Z" />
    <text x="16" y="17" textAnchor="middle" fill="#06C755" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8">LINE</text>
  </svg></span>;
}

export function ActiveChannelCard({ channel }: { channel: ActiveChannel }) {
  return <ActivationCard number={2} title="ช่องทางที่เปิดใช้งาน" description="ช่องทางที่ AI จะตอบลูกค้าในปัจจุบัน">
    <div className={styles.channelRow}>
      <LineMark /><div className={styles.rowCopy}><h3>{channel.platformName}</h3><p>{channel.storeName}</p></div>
      <span className={`${styles.channelBadge} ${!channel.connected ? styles.warningBadge : ""}`}>{channel.connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}</span>
    </div>
  </ActivationCard>;
}

export function AiSummaryCard({ summary }: { summary: AiSummary }) {
  return <ActivationCard number={3} title="สรุปการตั้งค่า AI" description="ข้อมูลสำคัญที่คุณตั้งค่าไว้">
    <table className={styles.summaryTable} aria-label="สรุปการตั้งค่า AI ที่บันทึกไว้">
      <tbody>
        <tr><th scope="row">ชื่อผู้ช่วย</th><td>{summary.assistantName}</td></tr>
        <tr><th scope="row">รูปแบบการพูด</th><td>{summary.tone}</td></tr>
        <tr><th scope="row">เมื่อไม่ทราบคำตอบ</th><td>{summary.fallbackBehavior}</td></tr>
      </tbody>
    </table>
  </ActivationCard>;
}

export function ActivationConfirmationCard({ confirmed, disabled, onChange }: {
  confirmed: boolean; disabled: boolean; onChange: (confirmed: boolean) => void;
}) {
  return <ActivationCard number={4} title="ยืนยันการเปิดใช้งาน">
    <div className={styles.confirmationContent}>
      <p className={styles.infoBanner}><ShieldCheck aria-hidden="true" /><span>AI จะเริ่มตอบข้อความใหม่จากลูกค้าผ่าน LINE OA</span></p>
      <p className={styles.helpText}>คุณสามารถหยุดการตอบอัตโนมัติได้ที่หน้าตั้งค่า</p>
      <label className={styles.confirmation}>
        <input id="activation-confirmation" type="checkbox" checked={confirmed} disabled={disabled} onChange={event => onChange(event.target.checked)} />
        <span>ฉันตรวจสอบข้อมูลแล้ว และพร้อมเปิดให้ AI ตอบลูกค้า</span>
      </label>
    </div>
  </ActivationCard>;
}
