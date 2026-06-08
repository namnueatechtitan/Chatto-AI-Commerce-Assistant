import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: "Chatto Dashboard",
  description: "Merchant dashboard for the Chatto AI Commerce Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${inter.variable} ${notoSansThai.variable} bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
