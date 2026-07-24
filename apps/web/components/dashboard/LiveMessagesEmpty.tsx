/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน Live ข้อความ Empty ที่ใช้ประกอบหน้า dashboard
 */

import { Inbox } from "lucide-react";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์สถานะว่างของ Live ข้อความ
 */
export function LiveMessagesEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
        <Inbox className="size-6" />
      </div>
      <div className="mt-4 text-base font-semibold text-slate-950">
        ยังไม่มีข้อความเข้ามา
      </div>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
        เมื่อลูกค้าส่งข้อความผ่าน LINE OA ข้อความจะปรากฏที่นี่แบบเรียลไทม์
      </p>
    </div>
  );
}
