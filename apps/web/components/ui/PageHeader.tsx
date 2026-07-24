/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ UI แบบใช้ซ้ำชื่อ Page Header
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วนหัวของ Page
 */
export function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      {actions ?? null}
    </div>
  );
}
