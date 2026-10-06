"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMerchantActivation } from "../../hooks/use-merchant-activation";
import { Button } from "../ui/Button";

export function MerchantAiControl({ merchantId, canEdit }: { merchantId: string; canEdit: boolean }) {
  const router = useRouter();
  const { readiness, loading, pending, error, refresh, change } = useMerchantActivation(merchantId);
  const [confirming, setConfirming] = useState(false);
  const [paused, setPaused] = useState(false);
  const pause = async () => {
    if (!canEdit || !readiness?.aiEnabled || pending) return;
    const success = await change(false);
    setConfirming(false); setPaused(success);
    if (success) router.refresh();
  };
  return <div className="content-stack" aria-busy={pending || loading}>
    {loading && <p role="status">กำลังโหลดสถานะ AI…</p>}
    {error && <div role="alert"><p>{error}</p><Button variant="secondary" disabled={pending || loading} onClick={() => void refresh()}>ลองใหม่</Button></div>}
    {readiness && <>
      <p role="status">{readiness.aiEnabled ? "AI เปิดใช้งานแล้ว" : "AI หยุดการตอบอัตโนมัติอยู่"}</p>
      <p className="helper-text">LINE OA: {readiness.channel.connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}</p>
      {!canEdit && <p>เฉพาะ Owner ของร้านเท่านั้นที่เปิดหรือหยุด AI ได้</p>}
      {readiness.aiEnabled ? <Button id="pause-ai" variant="secondary" disabled={!canEdit || pending || loading} onClick={() => setConfirming(true)}>หยุดการตอบอัตโนมัติ</Button>
        : <Link className="text-primary underline" href={`/onboarding/activation?merchantId=${encodeURIComponent(merchantId)}`}>ตรวจสอบความพร้อมและเปิดใช้งาน AI</Link>}
      {confirming && <div role="dialog" aria-modal="false" aria-labelledby="pause-ai-title" className="rounded-xl border border-border p-4 space-y-3">
        <h2 id="pause-ai-title">หยุดการตอบอัตโนมัติ?</h2>
        <p>AI จะหยุดตอบข้อความใหม่จากลูกค้า แต่การเชื่อมต่อ LINE OA และข้อมูลร้านค้าจะยังคงอยู่</p>
        <div className="flex flex-wrap gap-3"><Button id="confirm-pause-ai" disabled={pending} onClick={() => void pause()}>{pending ? "กำลังหยุด…" : "ยืนยันหยุด AI"}</Button><Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>ยกเลิก</Button></div>
      </div>}
    </>}
    {paused && <p role="status">หยุดการตอบอัตโนมัติแล้ว การเชื่อมต่อ LINE OA และข้อมูลร้านยังคงอยู่</p>}
  </div>;
}
