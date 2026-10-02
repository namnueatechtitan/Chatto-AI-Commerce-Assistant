"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Faq, StoreInformation } from "../../lib/store-information-types";
import { CatalogImport } from "./catalog-import";
import styles from "./store-information-form.module.css";

const categories = [["flowers", "ดอกไม้ / ของขวัญ"], ["fashion", "แฟชั่น / เสื้อผ้า"], ["beauty", "ความงาม / สุขภาพ"], ["food", "อาหาร / เครื่องดื่ม"], ["home", "บ้าน / ของใช้"], ["electronics", "อิเล็กทรอนิกส์"], ["services", "บริการ"], ["other", "อื่น ๆ"]];
type Field = "shopName" | "businessCategory" | "operatingHours" | "description" | "phone" | "email" | "address";
type EditableFaq = Faq & { key: string };

export function StoreInformationForm({ initial }: { initial?: StoreInformation }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  const requestId = useRef<string | null>(null);
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState<Record<Field, string>>({ shopName: initial?.merchant.shopName || "", businessCategory: initial?.merchant.businessCategory || "", operatingHours: initial?.merchant.operatingHours || "", description: initial?.merchant.description || "", phone: initial?.merchant.phone || "", email: initial?.merchant.email || "", address: initial?.merchant.address || "" });
  const [faqs, setFaqs] = useState<EditableFaq[]>(initial?.faqs.length ? initial.faqs.map((faq) => ({ ...faq, key: faq.id! })) : [{ key: "initial", question: "", answer: "" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const disabled = initial?.canEdit === false;
  const field = (name: Field, label: string, placeholder: string, options: { required?: boolean; multiline?: boolean; max?: number; type?: string; className?: string } = {}) => <div className={styles.field}>
    <label htmlFor={name}>{label}{options.required && <span aria-label="จำเป็น"> *</span>}</label>
    {options.multiline
      ? <textarea id={name} name={name} className={options.className} placeholder={placeholder} value={values[name]} maxLength={options.max} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} disabled={disabled || busy} onChange={(event) => setValues({ ...values, [name]: event.target.value })} />
      : <input id={name} name={name} type={options.type || "text"} placeholder={placeholder} value={values[name]} maxLength={options.max || 255} aria-required={options.required} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} disabled={disabled || busy} onChange={(event) => setValues({ ...values, [name]: event.target.value })} />}
    {errors[name] && <span className={styles.error} id={`${name}-error`}>{errors[name]}</span>}
  </div>;

  const save = async (skip: boolean, navigate: boolean): Promise<string | null> => {
    if (pending.current || disabled || conflict) return null;
    const nextErrors: Record<string, string> = {};
    for (const [name, label] of [["shopName", "ชื่อร้าน"], ["businessCategory", "หมวดหมู่ธุรกิจ"], ["operatingHours", "เวลาทำการ"]] as const) {
      if (!values[name].trim()) nextErrors[name] = `กรุณากรอก${label}`;
    }
    if (/[\x00-\x1f\x7f]/.test(values.operatingHours)) nextErrors.operatingHours = "กรอกเวลาทำการเป็นข้อความบรรทัดเดียว เช่น จ.–ศ. 09:30–18:00";
    if (values.phone.trim() && !/^[+\d][\d ()-]{5,29}$/.test(values.phone.trim())) nextErrors.phone = "กรอกเบอร์โทร 6–30 ตัวอักษร เช่น 081-234-5678";
    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = "กรอกอีเมลร้านให้ถูกต้อง";
    const filled = faqs.filter((faq) => faq.question.trim() || faq.answer.trim());
    if (!skip) for (const faq of filled) if (!faq.question.trim() || !faq.answer.trim()) nextErrors[`faq-${faq.key}`] = "กรอกคำถามและคำตอบให้ครบ หรือลบรายการนี้";
    setErrors(nextErrors); setMessage("");
    if (Object.keys(nextErrors).length) {
      setMessage("ตรวจสอบข้อมูลที่จำเป็นก่อนบันทึก");
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return null;
    }
    pending.current = true; setBusy(true);
    try {
      requestId.current ??= crypto.randomUUID();
      // Skip preserves the previous saved pair when an existing FAQ edit is incomplete.
      const optionalFaqs = faqs.flatMap((faq): Faq[] => {
        if (faq.question.trim() && faq.answer.trim()) return [{ id: faq.id, question: faq.question, answer: faq.answer }];
        const previous = skip && faq.id ? saved?.faqs.find((item) => item.id === faq.id) : undefined;
        return previous ? [previous] : [];
      });
      const response = await fetch(saved ? `/api/merchants/${saved.merchant.id}/information` : "/api/onboarding/store", {
        method: saved ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ ...values, faqs: optionalFaqs, ...(saved ? { revision: saved.merchant.informationRevision } : { requestId: requestId.current }) }),
      });
      if (response.status === 401) { router.replace("/login"); return null; }
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setConflict(true); throw new Error("ข้อมูลร้านมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง"); }
        if (response.status === 403 || response.status === 404) throw new Error("คุณไม่มีสิทธิ์แก้ไขร้านนี้ กรุณาเลือกร้านที่คุณเป็นเจ้าของ");
        throw new Error(Array.isArray(data.message) ? data.message.join(" · ") : data.message || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      const result = data as StoreInformation;
      setSaved(result);
      setFaqs(result.faqs.length ? result.faqs.map((faq) => ({ ...faq, key: faq.id! })) : [{ key: "empty", question: "", answer: "" }]);
      setMessage("บันทึกข้อมูลร้านเรียบร้อยแล้ว");
      if (navigate) { router.replace(`/onboarding?merchantId=${result.merchant.id}&saved=store`); router.refresh(); }
      else window.history.replaceState(null, "", `/onboarding/store?merchantId=${result.merchant.id}`);
      return result.merchant.id;
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง"); return null; }
    finally { pending.current = false; setBusy(false); }
  };

  return <form ref={form} className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); void save(false, true); }}>
    {disabled && <p className={`${styles.notice} ${styles.alert}`} role="alert">คุณสามารถดูข้อมูลร้านนี้ได้ เฉพาะเจ้าของร้านที่ใช้งานอยู่เท่านั้นที่แก้ไขได้</p>}
    <section className={styles.card} aria-labelledby="basic-heading">
      <h2 id="basic-heading">ข้อมูลพื้นฐานร้าน</h2><div className={styles.fields}>
        {field("shopName", "ชื่อร้าน", "เช่น FlowerShop", { required: true })}
        <div className={`${styles.row} ${styles.categoryRow}`}>
          <div className={styles.field}><label htmlFor="businessCategory">หมวดหมู่ธุรกิจ *</label>
            <select id="businessCategory" name="businessCategory" value={values.businessCategory} disabled={disabled || busy} aria-required="true" aria-invalid={Boolean(errors.businessCategory)} aria-describedby={errors.businessCategory ? "businessCategory-error" : undefined} onChange={(event) => setValues({ ...values, businessCategory: event.target.value })}>
              <option value="">เลือกหมวดหมู่</option>
              {values.businessCategory && !categories.some(([id]) => id === values.businessCategory) && <option value={values.businessCategory}>{values.businessCategory}</option>}
              {categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            {errors.businessCategory && <span className={styles.error} id="businessCategory-error">{errors.businessCategory}</span>}
          </div>
          {field("operatingHours", "เวลาทำการ", "เช่น จ.–ศ. 09:30–18:00", { required: true })}
        </div>
        {field("description", "คำอธิบายร้าน (ตัวเลือก)", "ใส่คำอธิบายร้านของคุณ", { multiline: true, max: 5000 })}
      </div>
    </section>
    <section className={styles.card} aria-labelledby="contact-heading">
      <h2 id="contact-heading">ช่องทางติดต่อ และที่อยู่</h2><div className={styles.fields}>
        <div className={styles.row}>{field("phone", "เบอร์โทรร้าน", "08X-XXX-XXXX", { type: "tel", max: 50 })}{field("email", "อีเมลร้าน", "ForExample@email.com", { type: "email" })}</div>
        {field("address", "ที่อยู่ร้าน / จุดรับสินค้า", "กรอกที่อยู่ร้านของคุณ", { multiline: true, max: 2000, className: styles.address })}
      </div>
    </section>
    <section className={styles.card} aria-labelledby="faq-heading">
      <h2 id="faq-heading">คำถามที่พบบ่อย (FAQ)</h2><p className={styles.hint}>เพิ่มคำถาม-คำตอบที่ลูกค้ามักถามบ่อย เพื่อเตรียมข้อมูลให้ AI ตอบได้แม่นยำขึ้น</p>
      <div className={styles.faqList}>{faqs.map((faq, index) => <div className={styles.faq} key={faq.key}>
        <div className={styles.faqHeader}><span>คำถามที่ {index + 1}</span><button type="button" className={styles.delete} disabled={disabled || busy} aria-label={`ลบคำถามที่ ${index + 1}`} onClick={() => setFaqs(faqs.filter((item) => item.key !== faq.key))}>ลบ</button></div>
        <div className={styles.field}><label htmlFor={`question-${faq.key}`}>คำถาม</label><input id={`question-${faq.key}`} placeholder="ร้านมีบริการจัดส่งไหม?" value={faq.question} maxLength={255} disabled={disabled || busy} aria-invalid={Boolean(errors[`faq-${faq.key}`])} aria-describedby={errors[`faq-${faq.key}`] ? `faq-error-${faq.key}` : undefined} onChange={(event) => setFaqs(faqs.map((item) => item.key === faq.key ? { ...item, question: event.target.value } : item))} /></div>
        <div className={styles.field}><label htmlFor={`answer-${faq.key}`}>คำตอบ</label><textarea id={`answer-${faq.key}`} placeholder="มีค่ะ จัดส่งทั่วประเทศผ่าน Kerry และ Flash โดยใช้เวลา 1–3 วันทำการ" value={faq.answer} maxLength={5000} disabled={disabled || busy} onChange={(event) => setFaqs(faqs.map((item) => item.key === faq.key ? { ...item, answer: event.target.value } : item))} /></div>
        {errors[`faq-${faq.key}`] && <p className={styles.error} id={`faq-error-${faq.key}`}>{errors[`faq-${faq.key}`]}</p>}
      </div>)}</div>
      <button type="button" className={styles.add} disabled={disabled || busy || faqs.length >= 50} onClick={() => setFaqs([...faqs, { key: crypto.randomUUID(), question: "", answer: "" }])}>+ เพิ่มคำถาม-คำตอบ</button>
    </section>
    <CatalogImport merchantId={saved?.merchant.id} disabled={disabled || busy || conflict} saveForUpload={() => save(true, false)} />
    {message && <p className={`${styles.notice} ${message !== "บันทึกข้อมูลร้านเรียบร้อยแล้ว" ? styles.alert : ""}`} role="status">{message}{conflict && <button type="button" className={styles.secondary} onClick={() => window.location.reload()}>โหลดข้อมูลล่าสุด</button>}</p>}
    <div className={styles.buttons}>
      <button type="button" className={styles.secondary} disabled={disabled || busy || conflict} onClick={() => void save(true, true)}>ข้ามไปก่อน</button>
      <button type="submit" className={styles.primary} disabled={disabled || busy || conflict}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูลร้าน"}</button>
    </div>
  </form>;
}
