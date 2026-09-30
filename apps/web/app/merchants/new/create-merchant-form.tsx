"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Merchant } from "../../../lib/merchants";

export function CreateMerchantForm() {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const shopName = String(new FormData(event.currentTarget).get("shopName") || "").trim();
    if (!shopName) {
      setError("กรุณาระบุชื่อร้านค้า");
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName }),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error("Create merchant failed");
      const { merchant } = await response.json() as { merchant: Merchant };
      router.replace(`/merchants/${merchant.id}`);
      router.refresh();
    } catch {
      setError("สร้างร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <p>
        <label htmlFor="shopName">ชื่อร้านค้า </label>
        <input id="shopName" name="shopName" required maxLength={255} disabled={pending} />
      </p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? "กำลังสร้างร้านค้า…" : "สร้างร้านค้า"}</button>
    </form>
  );
}
