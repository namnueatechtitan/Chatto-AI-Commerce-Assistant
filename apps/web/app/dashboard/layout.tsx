import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";

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
  return (
    <DashboardProviders>
      <div className="dashboard-shell xl:grid xl:grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0">
          <TopNavbar user={user} />
          <div className="border-b border-border bg-white px-4 py-3 xl:hidden">
            <Sidebar mobile />
          </div>
          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </DashboardProviders>
  );
}
