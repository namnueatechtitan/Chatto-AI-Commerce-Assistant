import type { Metadata } from "next";
import { Montserrat, Noto_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";

const thai = Noto_Sans_Thai({ subsets: ["thai"], display: "swap", variable: "--font-onboarding-thai" });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-onboarding-brand" });

export const metadata: Metadata = { title: "ตั้งค่าร้านค้า | Chatto AI Commerce Assistant" };

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <div className={`${thai.variable} ${montserrat.variable}`}>{children}</div>;
}
