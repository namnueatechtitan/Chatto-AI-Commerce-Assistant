"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { activationViewModel } from "../../lib/activation-view-model";
import { useMerchantActivation } from "../../hooks/use-merchant-activation";
import { Button } from "../ui/Button";
import { OnboardingBranding } from "./onboarding-branding";
import { ActiveChannelCard, ActivationConfirmationCard, AiSummaryCard, ReadinessCard } from "./activation-sections";
import base from "../../app/onboarding/onboarding.module.css";
import styles from "./activation.module.css";

function StepHeader({ contextHref }: { contextHref: string }) {
  return <>
    <Link className={styles.back} href={contextHref}><ArrowLeft aria-hidden="true" />กลับไปตั้งค่าบริบท AI</Link>
    <span className={styles.stepBadge}>ขั้นตอนที่ 6 จาก 6</span>
    <header className={styles.intro}><h1 id="setup-heading">เปิดใช้งานจริง</h1><p>ตรวจสอบความพร้อม และเปิดให้ AI ตอบลูกค้า</p></header>
  </>;
}

function ActivationActions({ contextHref, canActivate, activated, pending }: {
  contextHref: string; canActivate: boolean; activated: boolean; pending: boolean;
}) {
  return <div className={styles.actions}>
    <Link className={styles.editButton} href={contextHref}>กลับไปแก้ไข</Link>
    <Button id="activate-ai" className={styles.activateButton} type="submit" disabled={!canActivate || activated}>
      {pending ? "กำลังเปิดใช้งาน…" : activated ? "เปิดใช้งานแล้ว ✓" : <>เปิดใช้งาน AI<ArrowRight aria-hidden="true" /></>}
    </Button>
  </div>;
}

export function ActivationPage({ merchantId, contextHref, canEdit }: {
  merchantId: string; contextHref: string; canEdit: boolean;
}) {
  const router = useRouter();
  const { readiness, loading, pending, error, refresh, change } = useMerchantActivation(merchantId);
  const [confirmed, setConfirmed] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const activated = readiness?.aiEnabled === true;
  const canActivate = canEdit && readiness?.ready === true && confirmed && !activated && !succeeded && !pending && !loading;
  useEffect(() => {
    if (error) {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ block: "center" });
    }
  }, [error]);
  const data = readiness ? activationViewModel(readiness) : null;
  const confirmActivation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canActivate) return;
    const success = await change(true, { refreshAfter: false });
    setConfirmed(false);
    setSucceeded(success);
    if (success) router.replace(`/dashboard?merchantId=${encodeURIComponent(merchantId)}&activation=success`);
  };
  const activationError = error && <div ref={errorRef} className={styles.readOnly} role="alert" tabIndex={-1}>
    <p>{error}</p><Button type="button" variant="secondary" disabled={pending || loading} onClick={() => { setConfirmed(false); void refresh(); }}>ลองใหม่</Button>
  </div>;

  return <main className={base.page}>
    <OnboardingBranding fitViewport />
    <section className={styles.panel} aria-labelledby="setup-heading">
      <StepHeader contextHref={contextHref} />
      {!canEdit && <p className={styles.readOnly} role="status">ดูข้อมูลได้เท่านั้น เฉพาะ Owner ของร้านที่พร้อมใช้งานสามารถยืนยันได้</p>}
      {loading && <p className={styles.readOnly} role="status" aria-live="polite">กำลังโหลดความพร้อมของร้าน…</p>}
      {!data && activationError}
      {!loading && readiness?.ready === false && <p className={styles.readOnly} role="status">ตรวจสอบรายการที่ยังไม่ครบ: {data?.readinessItems.filter(item => !item.ready).map(item => item.title).join(", ")}</p>}
      {activated && <p className={styles.success} role="status">AI เปิดใช้งานแล้ว</p>}
      {data && <form className={styles.form} onSubmit={confirmActivation} aria-busy={pending || loading}>
        <div className={styles.sections}>
          <ReadinessCard items={data.readinessItems} />
          <ActiveChannelCard channel={data.channel} />
          <AiSummaryCard summary={data.aiSummary} />
          <ActivationConfirmationCard confirmed={confirmed} disabled={!canEdit || readiness?.ready !== true || activated || pending || loading} onChange={setConfirmed} />
        </div>
        {activationError}
        <ActivationActions contextHref={contextHref} canActivate={canActivate} activated={activated} pending={pending} />
        {succeeded && <div className={styles.success} role="status" aria-live="polite">
          <CheckCircle2 aria-hidden="true" /><div><p>เปิดใช้งาน AI สำเร็จ</p><p>AI พร้อมตอบข้อความลูกค้าผ่าน LINE OA แล้ว</p></div>
        </div>}
      </form>}
      {activated && <Link className={styles.editButton} href={`/dashboard/settings?merchantId=${encodeURIComponent(merchantId)}`}>ไปหน้าตั้งค่า / หยุดการตอบ AI</Link>}
    </section>
  </main>;
}
