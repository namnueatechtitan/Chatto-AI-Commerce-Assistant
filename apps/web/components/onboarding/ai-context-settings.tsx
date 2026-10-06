"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { OnboardingBranding } from "./onboarding-branding";
import { AiCapabilitiesSection, AiFallbackSection, AiPersonalitySection, StoreRulesSection } from "./ai-context-sections";
import { aiContextPayload, settingsForForm, type AiContextSettings, type AiSettingsResponse } from "../../lib/ai-context-settings";
import { saveMerchantAiSettings } from "../../lib/merchant-ai-settings-api";
import base from "../../app/onboarding/onboarding.module.css";
import styles from "./ai-context.module.css";

function StepHeader({ backHref }: { backHref: string }) {
  return <>
    <Link className={styles.back} href={backHref}><ArrowLeft aria-hidden="true" />กลับไปยังการตั้งค่า</Link>
    <span className={styles.badge}>ขั้นตอนที่ 5 จาก 6</span>
    <header className={styles.intro}>
      <h1 id="setup-heading">ตั้งค่าบริบท AI</h1>
      <p>กำหนดบุคลิก โทนการพูด และขอบเขตการตอบของ Chatto AI ให้เหมาะกับร้านคุณ ก่อนเริ่มใช้งานจริง</p>
    </header>
  </>;
}

function OnboardingActions({ skipHref, disabled }: { skipHref: string; disabled: boolean }) {
  const router = useRouter();
  return <div className={styles.actions}>
    <Button type="button" variant="outline" className={styles.secondary} onClick={() => router.push(skipHref)}>ข้ามไปก่อน</Button>
    <Button type="submit" className={styles.primary} disabled={disabled}>
      บันทึกและไปขั้นตอนต่อไป<ArrowRight aria-hidden="true" />
    </Button>
  </div>;
}

export function AiContextSettingsPage({ merchantId, backHref, nextHref, canEdit, initialSettings }: {
  merchantId: string; backHref: string; nextHref: string; canEdit: boolean; initialSettings: AiSettingsResponse;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<AiContextSettings>(() => settingsForForm(initialSettings));
  const [nameError, setNameError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const saving = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const onChange = (changes: Partial<AiContextSettings>) => {
    setSettings((previous) => ({ ...previous, ...changes }));
    if (changes.assistantName !== undefined) setNameError(null);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !initialSettings.canEdit || saving.current) return;
    const payload = aiContextPayload(settings);
    if (!payload.assistantName) {
      setNameError("กรุณากรอกชื่อ AI ที่ใช้คุยกับลูกค้า");
      document.getElementById("assistant-name")?.focus();
      return;
    }
    saving.current = true;
    setContinuing(true);
    setSaveError(null);
    try {
      const saved = await saveMerchantAiSettings(merchantId, payload);
      setSettings(settingsForForm(saved));
      // Step 6 reviews remaining prerequisites; saving settings is enough to visit it.
      // The server route still checks membership and all prerequisites before Step 5.
      router.push(nextHref);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
        ? error.message : "ยังยืนยันการบันทึกไม่ได้ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบก่อนลองอีกครั้ง");
    } finally {
      saving.current = false;
      setContinuing(false);
    }
  };

  return <main className={base.page}>
    <OnboardingBranding className={styles.contextBrandPanel} />
    <section className={styles.panel} aria-labelledby="setup-heading">
      <StepHeader backHref={backHref} />
      {!canEdit && <p className={styles.readOnly} role="status">ดูการตั้งค่าได้เท่านั้น เฉพาะ Owner ของร้านที่พร้อมใช้งานสามารถแก้ไขการตั้งค่า AI ได้</p>}
      <form className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.sections} disabled={!canEdit || !initialSettings.canEdit || continuing}>
          <legend className={styles.visuallyHidden}>การตั้งค่าบริบท AI</legend>
          <AiPersonalitySection settings={settings} onChange={onChange} nameError={nameError} />
          <AiCapabilitiesSection settings={settings} onChange={onChange} />
          <StoreRulesSection settings={settings} onChange={onChange} />
          <AiFallbackSection settings={settings} onChange={onChange} />
        </fieldset>
        <OnboardingActions skipHref={backHref} disabled={!canEdit || !initialSettings.canEdit || continuing} />
        {continuing && <p role="status" className={styles.draftHint}>กำลังบันทึกการตั้งค่า AI…</p>}
        {saveError && <p role="alert" className={styles.error}>{saveError}</p>}
      </form>
    </section>
  </main>;
}
