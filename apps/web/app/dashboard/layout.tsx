import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getMyMerchants } from "../../lib/merchants";

import { Sidebar } from "../../components/dashboard/sidebar";
import { TopNavbar } from "../../components/dashboard/top-navbar";
import { DashboardProviders } from "./providers";

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
      <div className="dashboard-shell desktop:grid desktop:grid-cols-[15.5rem_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0">
          <TopNavbar user={user} />
          <div className="border-b border-border bg-white px-4 py-3 desktop:hidden">
            <Sidebar mobile />
          </div>
          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </DashboardProviders>
  );
}
