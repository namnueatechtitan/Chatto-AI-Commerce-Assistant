/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บการตั้งค่าหลักของ Next.js สำหรับแอปเว็บฝั่งหน้าบ้าน
 */

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@chatto/shared", "@chatto/config"],
};

export default nextConfig;
