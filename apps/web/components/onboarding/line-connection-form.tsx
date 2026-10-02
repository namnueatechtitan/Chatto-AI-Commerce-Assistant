"use client";

import Link from "next/link";
import { Copy, Eye, EyeOff } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import styles from "./line-connection.module.css";

type Field = "channelId" | "channelSecret" | "channelAccessToken";
const fields: { id: Field; label: string; secret: boolean }[] = [
  { id: "channelId", label: "Channel ID", secret: false },
  { id: "channelSecret", label: "Channel Secret", secret: true },
  { id: "channelAccessToken", label: "Channel Access Token", secret: true },
];
const emptyValues: Record<Field, string> = { channelId: "", channelSecret: "", channelAccessToken: "" };
const hiddenFields: Record<Field, boolean> = { channelId: false, channelSecret: false, channelAccessToken: false };

export function LineConnectionForm({ skipHref, webhookUrl }: { skipHref: string; webhookUrl: string | null }) {
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(emptyValues);
  const [visible, setVisible] = useState(hiddenFields);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Partial<Record<Field, string>> = {};
    for (const { id, label } of fields) {
      if (!values[id].trim()) nextErrors[id] = `กรุณากรอก ${label}`;
    }
    if (values.channelId.trim() && !/^\d+$/.test(values.channelId.trim())) {
      nextErrors.channelId = "กรอก Channel ID เป็นตัวเลขเท่านั้น";
    }
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    // Demonstration only: no network call, credential persistence or progress mutation.
    setValues(emptyValues);
    setVisible(hiddenFields);
    setMessage("ระบบเชื่อมต่อ LINE OA จะพร้อมใช้งานเมื่อเชื่อมต่อ Backend");
  }

  async function copyWebhookUrl() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopyMessage("คัดลอก Webhook URL แล้ว");
    } catch {
      setCopyMessage("คัดลอกไม่ได้ กรุณาเลือกและคัดลอก URL ด้วยตนเอง");
    }
  }

  return (
    <form ref={form} className={styles.form} autoComplete="off" noValidate onSubmit={submit}>
      <section className={`${styles.card} ${styles.channelCard}`} aria-labelledby="channel-heading">
        <div className={styles.sectionHeader}>
          <span className={styles.number} aria-hidden="true">1</span>
          <div>
            <h2 id="channel-heading">รับ Channel จาก LINE Developers</h2>
            <p>เปิดใช้ Messaging API ใน LINE Official Account Manager จากนั้นคัดลอกข้อมูล Channel จาก LINE Developers Console มากรอกด้านล่าง</p>
            <a className={styles.guide} href="https://developers.line.biz/en/docs/messaging-api/getting-started/" target="_blank" rel="noopener noreferrer">ดูวิธีการทีละขั้นตอน<span className={styles.srOnly}> (เปิดในแท็บใหม่)</span></a>
          </div>
        </div>
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
                  maxLength={secret ? 4096 : 255}
                  required
                  aria-invalid={Boolean(errors[id])}
                  aria-describedby={errors[id] ? `${id}-error` : undefined}
                  onChange={(event) => {
                    setValues({ ...values, [id]: event.target.value });
                    setErrors({ ...errors, [id]: undefined });
                    setMessage("");
                  }}
                />
                {secret && (
                  <button className={styles.visibility} type="button" aria-label={`${visible[id] ? "ซ่อน" : "แสดง"} ${label}`} aria-controls={id} aria-pressed={visible[id]} onClick={() => setVisible({ ...visible, [id]: !visible[id] })}>
                    {visible[id] ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                )}
              </div>
              {errors[id] && <p id={`${id}-error`} className={styles.error} role="alert">{errors[id]}</p>}
            </div>
          ))}
        </div>
      </section>
      <section className={styles.card} aria-labelledby="webhook-heading">
        <div className={styles.sectionHeader}>
          <span className={styles.number} aria-hidden="true">2</span>
          <div>
            <h2 id="webhook-heading">ตั้งค่า Webhook URL</h2>
            <p>นำ URL นี้ไปวางในช่อง Webhook URL ที่หน้า LINE Developers Console แล้วกดเปิดใช้งาน</p>
          </div>
        </div>
        <div className={styles.webhook}>
          <span className={!webhookUrl ? styles.unconfigured : undefined}>{webhookUrl || "ยังไม่ได้กำหนด Webhook URL"}</span>
          <button className={styles.copy} type="button" aria-label="คัดลอก Webhook URL" disabled={!webhookUrl} onClick={() => void copyWebhookUrl()}>
            <Copy size={18} aria-hidden="true" />
          </button>
        </div>
        <p className={styles.copyMessage} role="status">{copyMessage}</p>
      </section>
      <div className={styles.actions}>
        <Link className={styles.secondary} href={skipHref}>ข้ามไปก่อน</Link>
        <button className={styles.primary} type="submit">บันทึกและเชื่อมต่อ</button>
      </div>
      <p className={message ? styles.notice : styles.srOnly} role="status">{message}</p>
    </form>
  );
}
