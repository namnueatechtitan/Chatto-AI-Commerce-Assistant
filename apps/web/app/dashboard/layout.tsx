import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Noto_Sans_Thai } from "next/font/google";
import { getCurrentUser } from "../../lib/auth";
import { getMyMerchants } from "../../lib/merchants";

import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { DashboardProviders } from "./providers";
const thai = Noto_Sans_Thai({ subsets: ["thai"], display: "swap", variable: "--font-dashboard-thai" });

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const memberships = await getMyMerchants();
  if (memberships.length === 0) redirect("/onboarding");
  return (
    <DashboardProviders key={user.id} userId={user.id}>
      <div className={thai.variable}><DashboardShell user={user} memberships={memberships}>{children}</DashboardShell></div>
    </DashboardProviders>
  );
}
