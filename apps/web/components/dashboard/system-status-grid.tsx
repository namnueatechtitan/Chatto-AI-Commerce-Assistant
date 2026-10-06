import Link from "next/link";
import { BookOpenText, Bot, CircleHelp, MessageCircle, SlidersHorizontal } from "lucide-react";
import type { ActivationReadiness } from "../../lib/merchant-activation-api";
import styles from "./merchant-dashboard.module.css";

export function SystemStatusGrid({ readiness, merchantId, loading, error, refresh }: { readiness?: ActivationReadiness; merchantId: string | null; loading: boolean; error: string | null; refresh: () => void }) {
  const pending = loading ? "กำลังโหลด…" : error ? "โหลดไม่สำเร็จ" : !merchantId ? "เลือกร้านค้าก่อน" : null;
  const cards = [
    { title: "AI Model Status", icon: Bot, value: pending ?? (readiness?.aiEnabled ? "เปิดการตอบอัตโนมัติ" : "หยุดการตอบอัตโนมัติ"), note: "สถานะการเปิด AI ไม่ใช่ผลทดสอบโมเดล", action: "ตั้งค่า AI", path: "/dashboard/settings" },
    { title: "Knowledge Base", icon: BookOpenText, value: pending ?? (readiness?.checks.knowledge.productsCount ? `${readiness.checks.knowledge.productsCount} รายการ` : "ยังไม่มีข้อมูลสินค้า"), note: "ข้อมูลสินค้าของร้าน", action: "จัดการความรู้", path: "/dashboard/products" },
    { title: "FAQ", icon: CircleHelp, value: pending ?? (readiness?.checks.knowledge.faqCount ? `${readiness.checks.knowledge.faqCount} รายการ` : "ยังไม่มี FAQ"), note: "คำถามที่พบบ่อยของร้าน", action: "จัดการ FAQ", path: "/onboarding/store" },
    { title: "LINE Official Account", icon: MessageCircle, value: pending ?? (readiness?.channel.connected ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ LINE Official Account"), note: readiness?.channel.displayName ?? "ช่องทางตอบลูกค้า", action: "จัดการการเชื่อมต่อ", path: "/onboarding/line" },
    { title: "AI Context", icon: SlidersHorizontal, value: pending ?? (readiness?.checks.aiContext.ready ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้งค่า"), note: readiness?.aiSummary.assistantName ?? "บุคลิกและกฎของ AI", action: "จัดการบริบท", path: "/onboarding/context" },
  ];
  return <section className={styles.systemGrid} aria-label="สถานะระบบของร้าน">{cards.map(({ title, icon: Icon, value, note, action, path }) => <article className={styles.systemCard} key={title}><h2><Icon size={16} aria-hidden="true" />{title}</h2><p>{value}</p><small>{note}</small>{merchantId && (error ? <button className={styles.textButton} onClick={refresh}>ลองใหม่</button> : <Link href={`${path}?merchantId=${encodeURIComponent(merchantId)}`}>{action}</Link>)}</article>)}</section>;
}
