import type { ReactNode } from "react";

import { Sidebar } from "../../components/ui/Sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <strong>Phase 2 Merchant Dashboard</strong>
            <div className="dashboard-header-meta">
              Scaffold mode for auth, product, knowledge, conversation, and
              handover flows
            </div>
          </div>
          <span className="badge">Mock data only</span>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
