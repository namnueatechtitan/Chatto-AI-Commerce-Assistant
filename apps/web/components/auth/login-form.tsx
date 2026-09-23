"use client";

import { useState, type FormEvent } from "react";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fields.get("email"), password: fields.get("password") }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีไม่พร้อมใช้งาน" : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่");
    } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <div><label htmlFor="email" className="text-sm font-medium">อีเมล</label>
      <input id="email" name="email" type="email" autoComplete="email" required className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></div>
    <div><label htmlFor="password" className="text-sm font-medium">รหัสผ่าน</label>
      <input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-emerald-700 p-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-50" type="submit">
      {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
    </button>
  </form>;
}
