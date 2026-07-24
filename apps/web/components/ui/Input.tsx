/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ UI แบบใช้ซ้ำชื่อ Input
 */

import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ช่องกรอกข้อมูลพร้อม label สำหรับฟอร์ม
 */
export function Input({ label, ...props }: InputProps) {
  return (
    <label className="label">
      <span>{label}</span>
      <input className="input" {...props} />
    </label>
  );
}
