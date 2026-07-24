/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ UI แบบใช้ซ้ำชื่อ Card
 */

import * as React from "react";

import { cn } from "../../lib/utils";

interface LegacyCardProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  children: React.ReactNode;
}

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์การ์ด  สำหรับแสดงข้อมูลใน UI
 */
function Card({
  title,
  className,
  children,
  ...props
}: LegacyCardProps) {
  if (title) {
    return (
      <section
        className={cn(
          "rounded-3xl border border-border bg-white shadow-card",
          className,
        )}
        {...props}
      >
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        </div>
        <div className="px-6 py-5">{children}</div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-3xl border border-border bg-white shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วนหัวของ Card
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 px-6 pt-6", className)}
    {...props}
  />
));

CardHeader.displayName = "CardHeader";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน Card Title ตามข้อมูลที่รับเข้ามา
 */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base font-semibold tracking-tight text-slate-950", className)}
    {...props}
  />
));

CardTitle.displayName = "CardTitle";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน Card Description ตามข้อมูลที่รับเข้ามา
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-slate-500", className)} {...props} />
));

CardDescription.displayName = "CardDescription";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วน Card Content ตามข้อมูลที่รับเข้ามา
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pb-6 pt-4", className)} {...props} />
));

CardContent.displayName = "CardContent";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วนท้ายของ Card
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center px-6 pb-6 pt-2", className)}
    {...props}
  />
));

CardFooter.displayName = "CardFooter";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
