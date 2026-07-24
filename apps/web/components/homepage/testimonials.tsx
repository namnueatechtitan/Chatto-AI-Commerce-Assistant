/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน testimonials ของหน้า landing page
 */

import { Star } from "lucide-react";

import { testimonials } from "../../lib/homepage-data";
import { Card } from "../ui/Card";
import { HomepageContainer } from "./container";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน Testimonials ตามข้อมูลที่รับเข้ามา
 */
export function Testimonials() {
  return (
    <section className="pt-16 lg:pt-20">
      <HomepageContainer>
        <div className="text-center">
          <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-slate-950">
            ลูกค้าของเราพูดว่า <span className="text-success">Chatto</span> ช่วยธุรกิจของพวกเขายังไง
          </h2>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {testimonials.map((testimonial, index) => (
            <Card
              key={`${testimonial.name}-${index}`}
              className="rounded-[24px] border border-slate-100 px-5 py-5 shadow-[0_12px_24px_rgba(15,23,42,0.05)]"
            >
              <div className="flex items-center gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star key={starIndex} className="size-4 fill-current" />
                ))}
              </div>
              <p className="mt-5 min-h-[72px] text-sm leading-7 text-slate-600">
                “{testimonial.quote}”
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-orange-400 text-sm font-semibold text-white">
                  {testimonial.name.slice(0, 1)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    {testimonial.name}
                  </div>
                  <div className="text-xs text-slate-500">{testimonial.business}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </HomepageContainer>
    </section>
  );
}
