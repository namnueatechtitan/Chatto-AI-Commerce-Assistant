"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { MessageOverviewPoint } from "../../lib/mock-data";
import { Card } from "../ui/Card";
import { PreviewLabel } from "./dashboard-overview";
import styles from "./merchant-dashboard.module.css";

export function MessageOverviewChart({ data, periodLabel, className }: { data: (MessageOverviewPoint & { handover?: number })[]; periodLabel: string; className?: string }) {
  return <Card className={`${styles.card} ${className ?? ""}`}><div className={styles.cardHeading}><h2>ภาพรวมข้อความ</h2><span className={styles.period}>{periodLabel}</span></div><div className={styles.legend}><span><i className={styles.totalDot} />ข้อความทั้งหมด</span><span><i className={styles.aiDot} />AI ตอบ</span><span><i className={styles.handoverDot} />Human Handover</span><PreviewLabel /></div><div className={styles.chart} role="img" aria-label="กราฟข้อความ 7 วัน ข้อมูลตัวอย่าง">
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 16, bottom: 0, left: 8, right: 10 }}><CartesianGrid stroke="#F0F0F0" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "#7D8781", fontSize: 10 }} /><Tooltip /><Line type="linear" dataKey="total" name="ข้อความทั้งหมด (ตัวอย่าง)" stroke="#22994A" strokeWidth={2} dot={{ r: 2 }} /><Line type="linear" dataKey="ai" name="AI ตอบ (ตัวอย่าง)" stroke="#4A8AFF" strokeWidth={2} dot={false} /><Line type="linear" dataKey="handover" name="Human Handover (ตัวอย่าง)" stroke="#AC74EB" strokeWidth={1.5} strokeDasharray="4 3" dot={false} /></LineChart></ResponsiveContainer>
  </div></Card>;
}
