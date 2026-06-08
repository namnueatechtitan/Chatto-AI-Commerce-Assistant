import { PackageSearch } from "lucide-react";

import { Card } from "../ui/Card";

interface WelcomeBannerProps {
  greeting: string;
  storeSummary: string;
  inventoryAlert: string;
}

export function WelcomeBanner({
  greeting,
  storeSummary,
  inventoryAlert,
}: WelcomeBannerProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_374px] xl:items-end">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-[2rem] font-semibold tracking-tight text-slate-950 sm:text-[2.25rem]">
            {greeting}
          </h1>
          <span className="text-3xl">👋</span>
        </div>
        <p className="text-base text-slate-600">{storeSummary}</p>
      </div>

      <Card className="overflow-hidden rounded-2xl border-0 bg-[#FEF6E8] shadow-none">
        <div className="grid grid-cols-[8px_minmax(0,1fr)]">
          <div className="rounded-l-2xl bg-warning" />
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/70 text-amber-600">
              <PackageSearch className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {inventoryAlert}
              </div>
              <div className="text-sm text-slate-500">
                ควรเติมสต็อกและอัปเดตข้อมูลเพื่อไม่ให้ AI ให้คำตอบคลาดเคลื่อน
              </div>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
