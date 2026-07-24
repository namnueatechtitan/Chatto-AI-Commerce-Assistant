/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน container ของหน้า landing page
 */

import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

interface HomepageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน Homepage Container ตามข้อมูลที่รับเข้ามา
 */
export function HomepageContainer({
  children,
  className,
}: HomepageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
