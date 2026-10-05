"use client";

import Link from "next/link";
import { Copy, Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changeLine, configureLine, lineConnected, lineWebhookReady, lineWebhookCopyable, LineApiError, readLineConfiguration,
  type LineConfiguration, type LineChannelMetadata } from "../../lib/merchant-line-api";
import { channelWebhookUrl } from "../../lib/line-webhook-url";
import styles from "./line-connection.module.css";

type Field = "channelId" | "channelSecret" | "channelAccessToken";
const fields: { id: Field; label: string; secret: boolean }[] = [
  { id: "channelId", label: "Channel ID", secret: false },
  { id: "channelSecret", label: "Channel Secret", secret: true },
  { id: "channelAccessToken", label: "Channel Access Token", secret: true },
];
const emptyValues: Record<Field, string> = { channelId: "", channelSecret: "", channelAccessToken: "" };
const hiddenFields: Record<Field, boolean> = { channelId: false, channelSecret: false, channelAccessToken: false };
const verificationMessage = "กำลังตรวจสอบข้อมูลกับ LINE...";
const readyMessage = "ตรวจสอบข้อมูลสำเร็จ พร้อมนำ Webhook URL ไป Verify ใน LINE Developers";
const connectedMessage = "LINE OA ของคุณพร้อมใช้งาน";
const confirmationMessage = (channel: LineChannelMetadata) => lineConnected(channel) ? connectedMessage : readyMessage;
const accessFailure = (error: unknown) => error instanceof LineApiError && [401, 403, 404].includes(error.status);

export function LineConnectionForm({ skipHref, webhookPrefix, merchantId, canEdit }: {
  skipHref: string; webhookPrefix: string | null; merchantId: string; canEdit: boolean;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const mutationInProgress = useRef(false);
  const configurationGeneration = useRef(0);
  const [values, setValues] = useState(emptyValues);
  const [visible, setVisible] = useState(hiddenFields);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [configuration, setConfiguration] = useState<LineConfiguration>({ current: null, history: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const current = configuration.current;
  const connected = loaded && lineConnected(current);
  const webhookUrl = loaded ? channelWebhookUrl(webhookPrefix, current?.id) : null;
  const canCopyWebhook = Boolean(webhookUrl && lineWebhookCopyable(current) && !busy && !blocked);
  const webhookDescription = !loaded
    ? loadFailed ? "ไม่สามารถโหลด Webhook URL ได้ กรุณากดโหลดสถานะใหม่" : "กำลังโหลด Webhook URL"
    : !webhookPrefix
      ? "URL สำหรับรับข้อความยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ"
      : !current
        ? "กรอกข้อมูลและกดบันทึกข้อมูล LINE ในขั้นตอนที่ 1 ก่อน เพื่อรับ Webhook URL ของร้านนี้"
        : "ไม่สามารถแสดง Webhook URL ได้ กรุณากดโหลดสถานะใหม่";
  const writable = canEdit && loaded && !busy && !blocked;
  const statusText = verifying ? verificationMessage : connected ? "เชื่อมต่อแล้ว" : lineWebhookReady(current) ? "รอการยืนยัน Webhook"
    : current?.status === "CONFIGURED" ? "บันทึกแล้ว รอตรวจสอบข้อมูล LINE" : current?.status === "ERROR" ? "ตรวจสอบข้อมูล LINE ไม่สำเร็จ" : "ยังไม่ได้เชื่อมต่อ";
  const failure = useCallback((error: unknown, verification = false) => {
    setMessage("");
    const reason = error instanceof LineApiError ? error.message : "ไม่สามารถติดต่อระบบได้ กรุณาลองอีกครั้ง";
    setErrorMessage(verification ? `ตรวจสอบข้อมูล LINE ไม่สำเร็จ — ${reason}` : reason);
    if (accessFailure(error)) {
      setBlocked(true); setValues(emptyValues); setVisible(hiddenFields);
      setConfiguration({ current: null, history: [] });
      if (error instanceof LineApiError && error.status === 401) router.replace("/login");
    }
  }, [router]);
  const load = useCallback(async (signal?: AbortSignal, preserveConfirmed = false) => {
    const generation = ++configurationGeneration.current;
    setLoadFailed(false);
    try {
      const data = await readLineConfiguration(merchantId, signal);
      if (signal?.aborted || generation !== configurationGeneration.current) return;
      setConfiguration(data); setLoaded(true);
      setValues(previous => ({ ...previous, channelId: previous.channelId || data.current?.externalChannelId || "" }));
    } catch (error) {
      if (!signal?.aborted && generation === configurationGeneration.current) {
        if (!preserveConfirmed) setLoaded(false);
        setLoadFailed(true);
        if (!preserveConfirmed || accessFailure(error)) failure(error);
      }
    }
  }, [merchantId, failure]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => { setCopyMessage(""); }, [webhookUrl]);
  useEffect(() => {
    if (!loaded || busy || blocked || current?.status !== "WEBHOOK_PENDING") return;
    const controller = new AbortController();
    let refreshing = false;
    async function refreshVerification() {
      if (refreshing || document.hidden || mutationInProgress.current || controller.signal.aborted) return;
      const generation = configurationGeneration.current;
      refreshing = true;
      try {
        const data = await readLineConfiguration(merchantId, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (controller.signal.aborted || mutationInProgress.current || generation !== configurationGeneration.current) return;
        setConfiguration(data);
        if (lineConnected(data.current)) {
          setMessage(connectedMessage);
          router.refresh();
        }
      } catch (error) {
        if (!controller.signal.aborted && generation === configurationGeneration.current && !mutationInProgress.current &&
          accessFailure(error)) failure(error);
        // A temporary read failure is retried without replacing the persisted lifecycle state.
      } finally { refreshing = false; }
    }
    const refresh = () => { void refreshVerification(); };
    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort(); window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loaded, busy, blocked, current?.status, current?.id, merchantId, failure, router]);
  function update(channel: LineChannelMetadata) {
    setConfiguration(previous => ({ current: channel.status === "DISCONNECTED" ? null : channel,
      history: channel.status === "DISCONNECTED" ? [channel, ...previous.history.filter(item => item.id !== channel.id)] : previous.history }));
    if (lineConnected(channel) || channel.status === "DISCONNECTED") router.refresh();
  }
  async function action(kind: "verify" | "disconnect") {
    if (!writable || !current || mutationInProgress.current) return;
    mutationInProgress.current = true;
    configurationGeneration.current++;
    setBusy(true); setMessage(""); setErrorMessage(""); setVisible(hiddenFields);
    setVerifying(kind === "verify");
    if (kind === "verify") setMessage(verificationMessage);
    try {
      const channel = await changeLine(merchantId, current, kind); update(channel);
      if (kind === "disconnect") setValues(emptyValues);
      setMessage(kind === "disconnect" ? "ยกเลิกการเชื่อมต่อใน Chatto แล้ว" : confirmationMessage(channel));
    } catch (error) {
      failure(error, kind === "verify");
      if (!accessFailure(error)) await load(undefined, kind === "verify");
    }
    finally { mutationInProgress.current = false; setBusy(false); setVerifying(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!writable || mutationInProgress.current) return;
    setErrorMessage("");
    const nextErrors: Partial<Record<Field, string>> = {};
    for (const { id, label } of fields) {
      if (!current?.hasCredentials && !values[id].trim()) nextErrors[id] = `กรุณากรอก ${label}`;
    }
    if (values.channelId.trim() && !/^\d+$/.test(values.channelId.trim())) {
      nextErrors.channelId = "กรอก Channel ID เป็นตัวเลขเท่านั้น";
    }
    if (values.channelSecret && !/^[a-f0-9]{32}$/i.test(values.channelSecret)) nextErrors.channelSecret = "Channel Secret ต้องเป็นตัวอักษรฐานสิบหก 32 ตัว";
    if (values.channelAccessToken && !/^[\x21-\x7e]{16,4096}$/.test(values.channelAccessToken)) nextErrors.channelAccessToken = "ตรวจสอบ Channel Access Token (อย่างน้อย 16 ตัว ไม่มีช่องว่าง)";
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    // Blank saved credential fields mean keep the DB value; never submit fake masks or empty credentials.
    const input = { ...(values.channelId.trim() ? { externalChannelId: values.channelId.trim() } : {}),
      ...(values.channelSecret ? { channelSecret: values.channelSecret } : {}),
      ...(values.channelAccessToken ? { channelAccessToken: values.channelAccessToken } : {}), expectedRevision: current?.revision ??
        configuration.history.find(channel => channel.externalChannelId === values.channelId.trim())?.revision ?? 0 };
    mutationInProgress.current = true;
    configurationGeneration.current++;
    setBusy(true);
    setVisible(hiddenFields);
    let stored = false;
    try {
      const saved = await configureLine(merchantId, input); update(saved);
      stored = true;
      // Keep drafts on a rejected save. Clear secrets only once the backend confirms storage.
      setValues({ ...emptyValues, channelId: saved.externalChannelId ?? input.externalChannelId ?? "" });
      setMessage("บันทึกข้อมูล LINE สำเร็จ");
      document.getElementById("webhook-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (lineWebhookReady(saved)) {
        // The backend preserves proofs and revision on a no-op save.
        setMessage(`บันทึกข้อมูล LINE สำเร็จ — ${confirmationMessage(saved)}`);
        return;
      }
      setVerifying(true);
      setMessage(`บันทึกข้อมูล LINE สำเร็จ — ${verificationMessage}`);
      const verified = await changeLine(merchantId, saved, "verify"); update(verified);
      setMessage(confirmationMessage(verified));
      document.getElementById("webhook-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      failure(error, stored);
      if (!accessFailure(error)) await load(undefined, stored);
    }
    finally { mutationInProgress.current = false; setBusy(false); setVerifying(false); }
  }

  async function copyWebhookUrl() {
    if (!webhookUrl || !canCopyWebhook || mutationInProgress.current) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopyMessage("คัดลอก Webhook URL แล้ว");
    } catch {
      setCopyMessage("คัดลอกไม่ได้ กรุณาเลือกและคัดลอก URL ด้วยตนเอง");
    }
  }

  return (
    <>
    <div className={styles.connectionStatus} role="status">
      <span className={styles.statusDot} style={connected ? { background: "#22994a" } : undefined} aria-hidden="true" />
      <div><p>{loaded ? statusText : loadFailed ? "ไม่สามารถโหลดสถานะการเชื่อมต่อ" : "กำลังโหลดสถานะการเชื่อมต่อ"}</p>
        <p>{connected ? connectedMessage : loaded && current?.externalChannelId ? `Channel ID: ${current.externalChannelId}` : "กรอกข้อมูลด้านล่างเพื่อเชื่อมต่อบัญชี LINE OA ของคุณ"}</p></div>
    </div>
    <form ref={form} className={styles.form} autoComplete="off" noValidate onSubmit={submit} aria-busy={busy}>
      <section className={`${styles.card} ${styles.channelCard}`} aria-labelledby="channel-heading">
        <div className={styles.sectionHeader}>
          <span className={styles.number} aria-hidden="true">1</span>
          <div>
            <h2 id="channel-heading">บันทึกข้อมูล LINE OA</h2>
            <p>เปิดใช้ Messaging API ใน LINE Official Account Manager จากนั้นคัดลอกข้อมูล Channel จาก LINE Developers Console มากรอกด้านล่าง</p>
            <a className={styles.guide} href="https://developers.line.biz/en/docs/messaging-api/getting-started/" target="_blank" rel="noopener noreferrer">ดูวิธีการทีละขั้นตอน<span className={styles.srOnly}> (เปิดในแท็บใหม่)</span></a>
          </div>
        </div>
        {current?.hasCredentials && <p className={styles.savedHint}>ร้านนี้มีข้อมูล LINE ที่บันทึกแล้ว เว้นช่อง Secret หรือ Access Token ว่างเพื่อเก็บค่าเดิม กรอกเฉพาะช่องที่ต้องการเปลี่ยน</p>}
        <div className={styles.fields}>
          {fields.map(({ id, label, secret }) => (
            <div className={styles.field} key={id}>
              <label htmlFor={id}>{label}</label>
              <div className={styles.inputWrap}>
                <input
                  id={id}
                  type={secret && !visible[id] ? "password" : "text"}
                  className={secret ? styles.secretInput : undefined}
                  value={values[id]}
                  inputMode={secret ? "text" : "numeric"}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={current?.hasCredentials ? secret ? "บันทึกไว้แล้ว — เว้นว่างหากไม่ต้องการเปลี่ยน" : current.externalChannelId ?? undefined : undefined}
                  maxLength={secret ? 4096 : 255}
                  required={!current?.hasCredentials}
                  disabled={!writable}
                  aria-invalid={Boolean(errors[id])}
                  aria-describedby={errors[id] ? `${id}-error` : undefined}
                  onChange={(event) => {
                    setValues({ ...values, [id]: event.target.value });
                    setErrors({ ...errors, [id]: undefined });
                    setMessage("");
                    setErrorMessage("");
                  }}
                />
                {secret && (
                  <button className={styles.visibility} type="button" disabled={!writable} aria-label={`${visible[id] ? "ซ่อน" : "แสดง"} ${label}`} aria-controls={id} aria-pressed={visible[id]} onClick={() => setVisible({ ...visible, [id]: !visible[id] })}>
                    {visible[id] ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                )}
              </div>
              {errors[id] && <p id={`${id}-error`} className={styles.error} role="alert">{errors[id]}</p>}
            </div>
          ))}
        </div>
        <div className={styles.saveActions}>
          {errorMessage && <p className={styles.errorNotice} role="alert">{errorMessage}</p>}
          {message && <p className={styles.notice} role="status">{message}</p>}
          <button className={styles.primary} type="submit" disabled={!writable}>{verifying ? verificationMessage : busy ? "กำลังบันทึกข้อมูล..." : "บันทึกข้อมูล LINE"}</button>
          <p>เมื่อบันทึกสำเร็จ Webhook URL จะแสดง ระบบจะตรวจสอบข้อมูลกับ LINE ก่อนเปิดให้คัดลอก URL ไป Verify</p>
        </div>
      </section>
      <section className={styles.card} aria-labelledby="webhook-heading">
        <div className={styles.sectionHeader}>
          <span className={styles.number} aria-hidden="true">2</span>
          <div>
            <h2 id="webhook-heading">คัดลอก Webhook URL ไป Verify</h2>
            <p>LINE Developers Console → Messaging API → Webhook settings: วาง URL แล้วกด Update จากนั้นกด Verify และเปิด Use webhook</p>
          </div>
        </div>
        <div className={styles.webhook}>
          <span id="line-webhook-url" className={!webhookUrl ? styles.unconfigured : undefined}>{webhookUrl || webhookDescription}</span>
          <button className={styles.copy} type="button" aria-label="คัดลอก Webhook URL" aria-describedby="line-webhook-url" title={canCopyWebhook ? "คัดลอก Webhook URL" : webhookUrl ? "ต้องตรวจสอบข้อมูลกับ LINE สำเร็จก่อนคัดลอก URL ไป Verify" : webhookDescription} disabled={!canCopyWebhook} onClick={() => void copyWebhookUrl()}>
            <Copy size={18} aria-hidden="true" />
          </button>
        </div>
        <p className={styles.copyMessage} role="status">{copyMessage}</p>
        {loaded && current && <p className={styles.savedHint} role="status">{verifying ? verificationMessage : connected ? connectedMessage : lineWebhookReady(current) ? readyMessage : current.status === "ERROR" ? "ตรวจสอบข้อมูล LINE ไม่สำเร็จ กรุณาแก้ไขข้อมูลแล้วบันทึกหรือตรวจสอบใหม่ก่อนนำ URL ไป Verify" : "บันทึกข้อมูล LINE แล้ว กรุณาตรวจสอบข้อมูลกับ LINE ให้สำเร็จก่อนคัดลอก URL ไป Verify"}</p>}
        {current?.status === "WEBHOOK_PENDING" && <p className={styles.savedHint}>กำลังรอ LINE ยืนยัน Webhook หน้านี้จะตรวจสอบสถานะอัตโนมัติ คุณกลับจากหน้า LINE แล้วดูผลที่นี่ได้</p>}
      </section>
      <div className={styles.management}>
        <Link className={styles.secondary} href={skipHref}>ข้ามไปก่อน</Link>
      </div>
      <div className={styles.management}>
        <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setMessage(""); setErrorMessage(""); void load().then(() => router.refresh()); }}>โหลดสถานะใหม่</button>
        {current?.hasCredentials && !lineWebhookReady(current) && <button className={styles.secondary} type="button" disabled={!writable} onClick={() => void action("verify")}>ตรวจสอบข้อมูล LINE</button>}
        {current && <button className={styles.secondary} type="button" disabled={!writable} onClick={() => void action("disconnect")}>ยกเลิกการเชื่อมต่อ</button>}
        {connected && <Link className={styles.primary} href={`/onboarding/context?merchantId=${encodeURIComponent(merchantId)}`}>ต่อไป</Link>}
      </div>
      {!canEdit && <p className={styles.notice}>เฉพาะ Owner ของร้านค้าที่แก้ไขการเชื่อมต่อได้</p>}
    </form>
    </>
  );
}
