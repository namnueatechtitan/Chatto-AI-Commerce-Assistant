/**
 * หน้าที่ไฟล์: ไฟล์นี้รวม utility ขนาดเล็กที่หลายคอมโพเนนต์ของเว็บนำไปใช้ร่วมกัน
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * หน้าที่: รวม className หลายรูปแบบเข้าด้วยกันและจัดการการ merge class ของ Tailwind ให้ปลอดภัย
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
