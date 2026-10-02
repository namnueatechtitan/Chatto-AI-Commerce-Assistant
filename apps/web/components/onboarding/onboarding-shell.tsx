import { OnboardingBranding } from "./onboarding-branding";
import { ChevronDown, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { AuthUser } from "../../lib/auth";
import { getUserDisplayName } from "../../lib/user-display";
import { LogoutButton } from "../auth/logout-button";
import { ProfileAvatar } from "./profile-avatar";
import styles from "../../app/onboarding/onboarding.module.css";

export function OnboardingShell({ children, user, role }: { children: ReactNode; user?: AuthUser; role?: string | null }) {
  const name = user ? getUserDisplayName(user) : "";
  return (
    <main className={styles.page}>
      <OnboardingBranding />
      <section className={styles.contentPanel} aria-label="การตั้งค่าร้านค้า">
        <header className={styles.profileHeader}>
          {user && <details className={styles.profile}>
            <summary aria-label={`บัญชี ${name}`}>
              <ProfileAvatar src={user.avatarUrl} />
              <span className={styles.profileText}>
                <span className={styles.profileName}>{name}</span>
                {(role || user.globalRole) && <span className={styles.profileRole}>{role || user.globalRole}</span>}
              </span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className={styles.profileMenu}>
              <span className={styles.menuLabel}><UserRound size={16} aria-hidden="true" /> {name}</span>
              <LogoutButton />
            </div>
          </details>}
        </header>
        <div className={styles.content}>{children}</div>
      </section>
    </main>
  );
}
