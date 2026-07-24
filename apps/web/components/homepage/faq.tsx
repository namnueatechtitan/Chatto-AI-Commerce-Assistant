/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน FAQ ของหน้า landing page
 */

import { ChevronDown } from "lucide-react";

import { faqs } from "../../lib/homepage-data";
import { Button } from "../ui/Button";
import { HomepageContainer } from "./container";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน FAQ ตามข้อมูลที่รับเข้ามา
 */
export function FAQ() {
  return (
    <section className="pb-4 pt-16 lg:pt-20">
      <HomepageContainer>
        <div className="text-center">
          <h2 className="text-[1.8rem] font-bold tracking-[-0.04em] text-slate-950">
            คำถามที่พบบ่อย
          </h2>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-medium text-slate-800">
                {faq.question}
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-sm leading-7 text-slate-500">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button className="h-10 rounded-xl px-5 text-sm" variant="primary">
            ดูคำถามทั้งหมด
          </Button>
        </div>
      </HomepageContainer>
    </section>
  );
}
