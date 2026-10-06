"use client";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { AuthUser } from "../../lib/auth";
import type { MerchantMembership } from "../../lib/merchants";
import { dashboardMembership } from "../../lib/dashboard-model";
import { Sidebar } from "./sidebar";
import { TopNavbar } from "./top-navbar";
import styles from "./merchant-dashboard.module.css";

const MerchantContext = createContext<{
  memberships: MerchantMembership[]; selected: MerchantMembership | null; invalidSelection: boolean;
  selectMerchant: (id: string) => void;
} | null>(null);
export function useDashboardMerchant() {
  const context = useContext(MerchantContext);
  if (!context) throw new Error("Dashboard merchant context is unavailable");
  return context;
}
export function DashboardShell({ user, memberships, children }: { user: AuthUser; memberships: MerchantMembership[]; children: ReactNode }) {
  const params = useSearchParams(), router = useRouter();
  const [pending, startTransition] = useTransition();
  const selected = dashboardMembership(memberships, params.get("merchantId"));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null), drawer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
      if (event.key === "Tab") {
        const targets = Array.from(drawer.current?.querySelectorAll<HTMLElement>("button,a[href]") ?? []);
        const first = targets[0], last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [menuOpen]);
  function selectMerchant(id: string) {
    if (id && !memberships.some(item => item.merchant.id === id)) return;
    const query = new URLSearchParams(params.toString());
    if (id) query.set("merchantId", id); else query.delete("merchantId");
    query.delete("activation"); query.delete("preview"); query.delete("conversation");
    startTransition(() => router.replace(`/dashboard${query.size ? `?${query}` : ""}`, { scroll: false }));
  }
  return <MerchantContext.Provider value={{ memberships, selected, invalidSelection: params.has("merchantId") && !selected, selectMerchant }}>
    <div className={`dashboard-shell ${styles.shell}`}>
      <TopNavbar user={user} selected={pending ? null : selected} menuOpen={menuOpen} menuButtonRef={menuButton} onMenu={() => setMenuOpen(value => !value)} />
      {menuOpen && <>
        <button className={styles.backdrop} aria-label="ปิดเมนู" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} />
        <div ref={drawer} className={styles.drawer} role="dialog" aria-modal="true" aria-label="เมนูร้านค้า">
          <button className={styles.iconButton} aria-label="ปิดเมนูร้านค้า" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }}><X size={20} /></button>
          <div onClick={event => { if ((event.target as HTMLElement).closest("a")) setMenuOpen(false); }}><Sidebar className={styles.drawerSidebar} /></div>
        </div>
      </>}
      <main className={styles.main} aria-busy={pending}>{pending ? <p className={styles.empty} role="status">กำลังเปลี่ยนร้านค้า…</p> : children}</main>
    </div>
  </MerchantContext.Provider>;
}
