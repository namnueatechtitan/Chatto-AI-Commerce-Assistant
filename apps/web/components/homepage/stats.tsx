import { Headphones, ShieldCheck, UsersRound, Zap } from "lucide-react";

import { homepageAssets } from "../../lib/homepage-data";
import { HomepageContainer } from "./container";

const kpis = [
  {
    icon: ShieldCheck,
    value: "99.9%",
    title: "Uptime",
    subtitle: "ระบบเสถียร พร้อมใช้งาน",
  },
  {
    icon: Zap,
    value: "< 3 sec",
    title: "Response Time",
    subtitle: "ตอบกลับไว ภายใน 3 วินาที",
  },
  {
    icon: Headphones,
    value: "24/7",
    title: "AI Support",
    subtitle: "ดูแลลูกค้าตลอด 24 ชั่วโมง",
  },
  {
    icon: UsersRound,
    value: "100+",
    title: "Businesses",
    subtitle: "ธุรกิจไว้วางใจใช้งาน",
  },
];

const partners = [
  {
    label: "LINE",
    detail: "Official Account",
    logo: homepageAssets.lineLogo,
  },
  {
    label: "OpenAI",
    mark: "◎",
  },
  {
    label: "PostgreSQL",
    mark: "🐘",
  },
  {
    label: "NestJS",
    mark: "◉",
    markClassName: "text-red-500",
  },
  {
    label: "aws",
    mark: "⌣",
    markClassName: "text-orange-400",
  },
];

export function Stats() {
  return (
    <section className="pb-6">
      <HomepageContainer className="max-w-[1440px] lg:w-[80vw]">
        <div className="rounded-[32px] border border-slate-100 bg-white px-6 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;

              return (
                <div
                  key={kpi.title}
                  className="flex items-center gap-4 xl:border-r xl:border-slate-100 xl:pr-6 last:xl:border-r-0"
                >
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                    <Icon className="size-8" />
                  </div>
                  <div>
                    <div className="text-[1.65rem] font-bold leading-none text-success">
                      {kpi.value}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-600">{kpi.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{kpi.subtitle}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-5 max-w-[820px]">
          <div className="mb-2 text-center text-sm text-slate-500">
            เชื่อมต่อกับแพลตฟอร์มที่คุณใช้อยู่แล้ว
          </div>
          <div className="grid items-center gap-4 rounded-[24px] border border-slate-100 bg-white px-7 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:grid-cols-2 lg:grid-cols-5">
            {partners.map((partner) => (
              <div key={partner.label} className="flex items-center justify-center gap-2">
                {partner.logo ? (
                  <img
                    alt={`${partner.label} logo`}
                    className="h-9 w-auto"
                    src={partner.logo}
                  />
                ) : (
                  <span className={partner.markClassName ?? "text-slate-900"}>
                    {partner.mark}
                  </span>
                )}
                <div className="leading-tight">
                  <div className="text-base font-semibold text-slate-950">{partner.label}</div>
                  {partner.detail ? (
                    <div className="text-[10px] font-medium text-slate-500">
                      {partner.detail}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </HomepageContainer>
    </section>
  );
}
