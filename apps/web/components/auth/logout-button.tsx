"use client";

import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function logout() {
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.assign("/login");
    } catch { setError(true); setPending(false); }
  }
  return <div>
    <button type="button" disabled={pending} onClick={logout} className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">
      {pending ? "กำลังออก…" : "ออกจากระบบ"}
    </button>
    {error && <p role="alert" className="text-xs text-red-700">ออกจากระบบไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
  </div>;
}
