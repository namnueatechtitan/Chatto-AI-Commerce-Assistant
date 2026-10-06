"use client";
import { ExternalLink, Package } from "lucide-react";
import type { ActivationReadiness } from "../../lib/merchant-activation-api";
import { businessMetrics, dashboardPreviewCopy, previewConversations } from "../../lib/dashboard.mock";
import { Card } from "../ui/Card";
import { OwnershipBadge } from "./conversation-workspace";
import styles from "./merchant-dashboard.module.css";

export function PreviewLabel() { return <span className={styles.previewLabel}>ข้อมูลตัวอย่าง</span>; }
export function DashboardWelcome({ merchantName }: { merchantName?: string }) {
  return <section className={styles.welcome}><div><h1>ยินดีต้อนรับกลับมา ! <span aria-hidden="true">👋</span></h1><p>นี่คือภาพรวมของธุรกิจคุณในวันนี้{merchantName ? ` · ${merchantName}` : ""}</p></div><div className={styles.inventory}><Package size={30} aria-hidden="true" /><span>{dashboardPreviewCopy.inventoryAlert} <PreviewLabel /></span></div></section>;
}
export function BusinessMetricStrip() {
  return <section className={styles.metricStrip} aria-label="สรุปธุรกิจตัวอย่าง"><div className={styles.metricCaption}><PreviewLabel /></div><dl>{businessMetrics.map(metric => <div key={metric.id}><dt>{metric.label}<ExternalLink size={11} aria-hidden="true" /></dt><dd>{metric.value}</dd></div>)}</dl></section>;
}
export function LineChannelCard({ readiness, messageCount, merchantName, loading, error }: { readiness?: ActivationReadiness; messageCount: number | null; merchantName?: string; loading: boolean; error: boolean }) {
  return <Card className={styles.card}><div className={styles.cardHeading}><h2>ช่องทางการแชท</h2></div><div className={styles.channelContent}>
    <svg className={styles.donut} viewBox="0 0 140 140" role="img" aria-label={messageCount === null ? "ยังไม่ทราบจำนวนข้อความ" : `LINE ${messageCount} ข้อความล่าสุด`}><circle cx="70" cy="70" r="57" fill="none" stroke="#E9E9E9" strokeWidth="14" /><circle cx="70" cy="70" r="57" fill="none" stroke={messageCount ? "#22994A" : "#E9E9E9"} strokeWidth="14" /><text x="70" y="66" textAnchor="middle" className={styles.donutValue}>{messageCount === null ? "—" : messageCount}</text><text x="70" y="84" textAnchor="middle" className={styles.donutLabel}>ข้อความล่าสุด</text></svg>
    <div><strong>LINE Official Account</strong><p>{merchantName ?? "ยังไม่ได้เลือกร้าน"}</p><span className={`${styles.badge} ${readiness?.channel.connected ? styles.connected : ""}`}>{loading ? "กำลังตรวจสอบ…" : error ? "ตรวจสอบไม่สำเร็จ" : readiness?.channel.connected ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ"}</span><small>เฉพาะข้อความลูกค้าล่าสุดสูงสุด 20 รายการ</small></div>
  </div></Card>;
}
export function HandoverQueueCard({ openPreview }: { openPreview: (id: string) => void }) {
  return <Card className={styles.card}><div className={styles.cardHeading}><h2>ปัญหาที่ลูกค้าแจ้งเข้ามา</h2><PreviewLabel /></div><div className={styles.issueTable}><table><thead><tr><th>ลูกค้า</th><th>ปัญหา</th><th>สถานะ</th><th><span className={styles.srOnly}>การดำเนินการ</span></th></tr></thead><tbody>{previewConversations.map(message => <tr key={message.id}><td>{message.customerName}<small>LINE · ตัวอย่าง</small></td><td>{dashboardPreviewCopy.issue}</td><td><OwnershipBadge ownership={message.ownership} /></td><td><button className={message.ownership === "HUMAN" ? styles.outlineButton : styles.primaryButton} onClick={() => openPreview(message.id)}>ดูแชทตัวอย่าง</button></td></tr>)}</tbody></table></div></Card>;
}
