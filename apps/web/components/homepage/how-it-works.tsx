/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน how it works ของหน้า landing page
 */

import { Bot, Link2, LayoutPanelTop, PackagePlus } from "lucide-react";

import type { StepItem } from "../../lib/homepage-data";
import { howItWorksSteps } from "../../lib/homepage-data";
import { Card } from "../ui/Card";
import { HomepageContainer } from "./container";

const iconMap: Record<StepItem["icon"], typeof Link2> = {
  link: Link2,
  package: PackagePlus,
  bot: Bot,
  layout: LayoutPanelTop,
};

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน How It Works ตามข้อมูลที่รับเข้ามา
 */
export function HowItWorks() {
  return (
    <section className="pt-10" id="how-it-works">
      <HomepageContainer>
        <Card className="rounded-[30px] border border-slate-100 px-6 py-8 shadow-[0_20px_45px_rgba(15,23,42,0.06)] sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
            <div>
              <h2 className="text-[2rem] font-bold leading-tight tracking-[-0.04em] text-slate-950">
                เริ่มต้นใช้งาน Chatto
                <br />
                ง่าย ๆ แค่ <span className="text-success">4 ขั้นตอน</span>
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {howItWorksSteps.map((step, index) => {
                const Icon = iconMap[step.icon];

                return (
                  <div key={step.title} className="relative text-center">
                    {index < howItWorksSteps.length - 1 ? (
                      <div className="absolute left-[58%] top-7 hidden h-px w-[42%] border-t border-dashed border-slate-300 xl:block" />
                    ) : null}
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
                      <Icon className="size-7" />
                    </div>
                    <div className="mt-4 text-base font-semibold text-slate-950">
                      {step.title}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">
                      {step.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </HomepageContainer>
    </section>
  );
}
