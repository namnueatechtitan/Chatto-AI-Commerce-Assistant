import { Check, Sparkles } from "lucide-react";

import { pricingPlans } from "../../lib/homepage-data";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { HomepageContainer } from "./container";

export function Pricing() {
  return (
    <section className="pt-16 lg:pt-20" id="pricing">
      <HomepageContainer>
        <div className="text-center">
          <h2 className="text-[2.1rem] font-bold tracking-[-0.04em] text-slate-950">
            เลือก Packet ที่ใช่สำหรับ<span className="text-success">ธุรกิจของคุณ</span>
          </h2>
          <p className="mt-3 text-base text-slate-500">
            ยืดหยุ่น คุ้มค่า เติบโตไปพร้อมกับคุณ
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "relative rounded-[26px] border px-5 py-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]",
                plan.featured
                  ? "border-primary shadow-[0_18px_40px_rgba(34,197,94,0.12)]"
                  : "border-slate-200",
              )}
            >
              {plan.featured ? (
                <div className="absolute right-6 top-0 -translate-y-1/2 rounded-full border border-primary/20 bg-white px-4 py-1 text-xs font-semibold text-success">
                  Most Popular
                </div>
              ) : null}

              <div className="text-[1.8rem] font-semibold text-slate-950">{plan.name}</div>
              <div className="mt-1 text-sm text-slate-500">{plan.subtitle}</div>
              <div className="mt-5 text-4xl font-bold tracking-[-0.04em] text-slate-950">
                {plan.price}
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                    <span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-success/10 text-success">
                      <Check className="size-3.5" />
                    </span>
                    <span className="leading-6">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={cn(
                  "mt-8 h-11 w-full rounded-xl text-sm",
                  plan.featured ? "bg-success hover:bg-success/90" : "",
                )}
                variant={plan.featured ? "primary" : "outline"}
              >
                <span className="flex items-center justify-center gap-2">
                  {plan.featured ? <Sparkles className="size-4" /> : null}
                  {plan.cta}
                </span>
              </Button>
            </Card>
          ))}
        </div>
      </HomepageContainer>
    </section>
  );
}
