import type { RecentOrder } from "../../lib/mock-data";
import styles from "./merchant-dashboard.module.css";
import { Badge } from "../ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";

interface RecentOrdersCardProps {
  orders: RecentOrder[];
  className?: string;
  preview?: boolean;
}

const statusVariantMap: Record<RecentOrder["status"], "success" | "warning" | "danger"> = {
  paid: "success",
  pending: "warning",
  cancelled: "danger",
};

const statusLabelMap: Record<RecentOrder["status"], string> = {
  paid: "ชำระแล้ว",
  pending: "รอดำเนินการ",
  cancelled: "ยกเลิก",
};

export function RecentOrdersCard({
  orders,
  className,
  preview = false,
}: RecentOrdersCardProps) {
  if (preview) return <Card className={`${styles.card} ${className ?? ""}`}><div className={styles.cardHeading}><h2>คำสั่งซื้อล่าสุด</h2><span className={styles.previewLabel}>ข้อมูลตัวอย่าง</span></div><div className={styles.orderTable}><table><caption className={styles.srOnly}>คำสั่งซื้อตัวอย่าง ไม่ใช่คำสั่งซื้อของร้านจริง</caption><tbody>{orders.map(order => <tr key={order.id}><td>{order.id}</td><td>{order.customer}</td><td>{order.amount}</td><td><span className={`${styles.badge} ${order.status === "paid" ? styles.connected : order.status === "pending" ? styles.warning : styles.cancelled}`}>{statusLabelMap[order.status]}</span></td></tr>)}</tbody></table><p className={styles.muted}>ระบบคำสั่งซื้อยังไม่พร้อมใช้งาน</p></div></Card>;
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <CardTitle>คำสั่งซื้อล่าสุด</CardTitle>
        <div className="text-xs font-semibold text-success">ดูทั้งหมด →</div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-slate-100">
          {orders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="text-xs text-slate-500">{order.id}</div>
                <div className="mt-1 truncate text-sm font-medium text-slate-900">
                  {order.customer}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">
                  {order.amount}
                </div>
                <Badge
                  className="mt-1 w-fit"
                  variant={statusVariantMap[order.status]}
                >
                  {statusLabelMap[order.status]}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 text-xs font-semibold text-success">
          ดูออเดอร์ทั้งหมด →
        </div>
      </CardContent>
    </Card>
  );
}
