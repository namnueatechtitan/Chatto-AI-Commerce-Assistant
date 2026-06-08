import type { TopProduct } from "../../lib/mock-data";
import { cn } from "../../lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/Card";

interface TopProductsCardProps {
  products: TopProduct[];
  className?: string;
}

export function TopProductsCard({
  products,
  className,
}: TopProductsCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <CardTitle>สินค้าที่ถูกสอบถามมากที่สุด</CardTitle>
        <div className="text-xs font-semibold text-success">ดูทั้งหมด →</div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-slate-100">
          {products.map((product) => (
            <div
              key={product.rank}
              className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="w-4 text-sm font-semibold text-slate-400">
                {product.rank}
              </div>
              <div
                className={cn(
                  "flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br text-[11px] font-semibold text-slate-700",
                  product.accentClassName,
                )}
              >
                BAG
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">
                  {product.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">{product.sold}</div>
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {product.price}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 text-xs font-semibold text-success">
          ดูสินค้าทั้งหมด →
        </div>
      </CardContent>
    </Card>
  );
}
