"use client";
import { Bell, ChevronDown, Menu } from "lucide-react";
import type { RefObject } from "react";
import type { AuthUser } from "../../lib/auth";
import type { MerchantMembership } from "../../lib/merchants";
import { useDashboardReadiness } from "../../hooks/use-dashboard-readiness";
import { ProfileAvatar } from "../onboarding/profile-avatar";
import { LogoutButton } from "../auth/logout-button";
import styles from "./merchant-dashboard.module.css";

export function AiRuntimeStatus({ enabled, loading, error }: { enabled?: boolean; loading: boolean; error: string | null }) {
  const label = error ? "ตรวจสอบสถานะ AI ไม่สำเร็จ" : loading ? "กำลังตรวจสอบสถานะ AI…"
    : enabled === true ? "Chatto AI กำลังทำงานอยู่" : enabled === false ? "Chatto AI หยุดการตอบอัตโนมัติ" : "เลือกร้านค้าเพื่อดูสถานะ AI";
  return <span role="status" className={`${styles.runtime} ${enabled === true && !error ? styles.running : ""}`}><span aria-hidden="true" />{label}</span>;
}
export function TopNavbar({ user, selected, onMenu, menuOpen, menuButtonRef }: {
  user: AuthUser; selected: MerchantMembership | null; onMenu: () => void; menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const { readiness, loading, error } = useDashboardReadiness(selected?.merchant.id ?? null);
  return <header className={styles.navbar}>
    <button ref={menuButtonRef} className={styles.iconButton} aria-label="เปิดเมนูร้านค้า" aria-expanded={menuOpen} onClick={onMenu}><Menu size={24} /></button>
    <div className={styles.navRight}>
      <AiRuntimeStatus enabled={readiness?.aiEnabled} loading={loading} error={error} />
      <details className={styles.notifications}><summary aria-label="Open notifications" className={styles.iconButton}><Bell size={22} /></summary><div className={styles.popover}>ยังไม่มีระบบแจ้งเตือน</div></details>
      <details className={styles.profile}><summary><ProfileAvatar src={user.avatarUrl} /><span><strong>{user.name}</strong><small>{selected?.role.name ?? "ยังไม่ได้เลือกร้าน"}</small></span><ChevronDown size={18} aria-hidden="true" /></summary><div className={styles.popover}><LogoutButton /></div></details>
    </div>
  </header>;
}
