"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import styles from "../../app/onboarding/onboarding.module.css";

export function ProfileAvatar({ src }: { src?: string | null }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const safeSource = src?.startsWith("https://") ? src : null;
  return <span className={styles.avatar} aria-hidden="true">
    {safeSource && safeSource !== failedSource
      // Profile URLs belong to the authenticated profile; unknown image hosts are
      // intentionally not added to the global Next image allowlist.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={safeSource} alt="" width={40} height={40} referrerPolicy="no-referrer" onError={() => setFailedSource(safeSource)} />
      : <UserRound size={24} />}
  </span>;
}
