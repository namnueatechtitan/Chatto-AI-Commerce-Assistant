import type { ReactNode } from "react";

import { Sidebar } from "../../components/dashboard/sidebar";
import { TopNavbar } from "../../components/dashboard/top-navbar";
import { DashboardProviders } from "./providers";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <DashboardProviders>
      <div className="dashboard-shell xl:grid xl:grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0">
          <TopNavbar />
          <div className="border-b border-border bg-white px-4 py-3 xl:hidden">
            <Sidebar mobile />
          </div>
          <main className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </DashboardProviders>
  );
}
