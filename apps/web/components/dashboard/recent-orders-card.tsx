import type { RecentOrder } from "../../lib/mock-data";
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
}: RecentOrdersCardProps) {
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
