"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { AiCapabilities, AiContextSettings } from "../../lib/ai-context-settings";
import styles from "./ai-context.module.css";

type SettingsProps = {
  settings: AiContextSettings;
  onChange: (changes: Partial<AiContextSettings>) => void;
};

function SettingsSection({ number, title, description, children }: {
  number: number; title: string; description: string; children: ReactNode;
}) {
  const headingId = useId();
  return <Card className={styles.card} aria-labelledby={headingId}>
    <header className={styles.sectionHeader}>
      <span className={styles.number} aria-hidden="true">{number}</span>
      <div><h2 id={headingId}>{title}</h2><p>{description}</p></div>
    </header>
    {children}
  </Card>;
}

function Toggle({ checked, onChange, label, large = false }: {
  checked: boolean; onChange: (checked: boolean) => void; label: string; large?: boolean;
}) {
  return <input type="checkbox" role="switch" aria-label={label} checked={checked}
    className={`${styles.toggle} ${large ? styles.largeToggle : ""}`}
    onChange={(event) => onChange(event.target.checked)} />;
}

const tones = [
  ["friendly", "เป็นกันเอง"], ["polite", "สุภาพ"], ["professional", "มืออาชีพ"], ["concise", "กระชับ"],
] as const;
const lengths = [
  ["short", "สั้น", "1–2 ประโยค เหมาะสำหรับคำถามทั่วไป"],
  ["medium", "พอดี", "3–5 ประโยค เหมาะสำหรับการแนะนำสินค้า"],
  ["detailed", "ละเอียด", "อธิบายข้อมูลครบถ้วน เหมาะสำหรับคำถามเชิงเปรียบเทียบ"],
] as const;

export function AiPersonalitySection({ settings, onChange, nameError }: SettingsProps & { nameError: string | null }) {
  return <SettingsSection number={1} title="บุคลิกและโทนการพูดของ AI"
    description="กำหนดว่า AI จะคุยกับลูกค้าในฐานะอะไร และมีบุคลิกอย่างไร">
    <div className={styles.personality}>
      <div className={styles.identityRow}>
        <div className={styles.field}>
          <label htmlFor="assistant-name">ชื่อ AI ที่ใช้คุยกับลูกค้า</label>
          <input id="assistant-name" name="assistantName" placeholder="เช่น น้องแชท" value={settings.assistantName}
            maxLength={80} required aria-invalid={!!nameError} aria-describedby={nameError ? "assistant-name-error" : undefined}
            onChange={(event) => onChange({ assistantName: event.target.value })} />
          {nameError && <p id="assistant-name-error" role="alert" className={styles.error}>{nameError}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor="ai-pronoun">สรรพนามแทนตัวเอง</label>
          <select id="ai-pronoun" name="pronoun" value={settings.pronoun} onChange={(event) => onChange({ pronoun: event.target.value })}>
            {["ดิฉัน / ค่ะ", "ผม / ครับ", "เรา", "ไม่ระบุ"].map((pronoun) => <option key={pronoun}>{pronoun}</option>)}
          </select>
        </div>
      </div>
      <div className={styles.toneRow}>
        <fieldset className={styles.choiceGroup}>
          <legend>รูปแบบการพูดคุย</legend>
          <div className={styles.tones}>
            {tones.map(([value, label]) => <label key={value} className={styles.toneOption}>
              <input type="radio" name="tone" value={value} checked={settings.tone === value} onChange={() => onChange({ tone: value })} />
              <span>{label}</span>
            </label>)}
          </div>
        </fieldset>
        <div className={styles.field}>
          <label htmlFor="ai-language">ภาษาหลัก</label>
          <select id="ai-language" name="language" value={settings.language}
            onChange={(event) => onChange({ language: event.target.value === "en" ? "en" : "th" })}>
            <option value="th">ภาษาไทย</option><option value="en">English</option>
          </select>
        </div>
      </div>
      <div className={styles.emojiField}>
        <p>ระดับการใช้อิโมจิ</p>
        <div><span>ไม่ใช้เลย</span><Toggle label="อนุญาตให้ AI ใช้อิโมจิ" large checked={settings.useEmoji}
          onChange={(useEmoji) => onChange({ useEmoji })} /><span>ใช้ได้</span></div>
      </div>
      <fieldset className={`${styles.choiceGroup} ${styles.lengthGroup}`}>
        <legend>ความยาวคำตอบ</legend>
        <div className={styles.lengths}>
          {lengths.map(([value, title, description]) => <label key={value} className={styles.radioOption}>
            <input type="radio" name="responseLength" value={value} checked={settings.responseLength === value}
              onChange={() => onChange({ responseLength: value })} />
            <span><strong>{title}</strong><small>{description}</small></span>
          </label>)}
        </div>
      </fieldset>
    </div>
  </SettingsSection>;
}

const capabilities: Array<[keyof AiCapabilities, string]> = [
  ["recommendProducts", "แนะนำสินค้าให้ลูกค้า"], ["checkStock", "เช็คสินค้าในสต็อก"],
  ["compareProducts", "เปรียบเทียบสินค้า"], ["answerFaq", "ตอบคำถาม FAQ"],
  ["showPrices", "แจ้งราคา"], ["rememberCustomerInterest", "จดจำความสนใจของลูกค้า"],
  ["showPromotions", "แจ้งโปรโมชั่น"], ["recommendRelatedProducts", "แนะนำสินค้าที่เกี่ยวข้อง"],
];

export function AiCapabilitiesSection({ settings, onChange }: SettingsProps) {
  return <SettingsSection number={2} title="ความสามารถของ AI" description="เลือกสิ่งที่คุณต้องการให้ AI ช่วยตอบลูกค้า">
    <div className={styles.capabilities}>
      {capabilities.map(([key, label]) => <label key={key} className={styles.capability}>
        <span>{label}</span><Toggle label={label} checked={settings.capabilities[key]}
          onChange={(checked) => onChange({ capabilities: { ...settings.capabilities, [key]: checked } })} />
      </label>)}
    </div>
  </SettingsSection>;
}

export function StoreRulesSection({ settings, onChange }: SettingsProps) {
  const ruleInputs = useRef(new Map<string, HTMLInputElement>());
  const addRule = () => {
    if (settings.rules.length >= 20) return;
    const id = `local-${crypto.randomUUID()}`;
    onChange({ rules: [...settings.rules, { id, text: "" }] });
    requestAnimationFrame(() => ruleInputs.current.get(id)?.focus());
  };
  const removeRule = (id: string) => {
    const index = settings.rules.findIndex((rule) => rule.id === id);
    const remaining = settings.rules.filter((rule) => rule.id !== id);
    onChange({ rules: remaining });
    requestAnimationFrame(() => {
      const next = remaining[Math.min(index, remaining.length - 1)];
      if (next) ruleInputs.current.get(next.id)?.focus();
      else document.getElementById("add-store-rule")?.focus();
    });
  };
  return <SettingsSection number={3} title="กฎของร้าน" description="กำหนดแนวทางหรือข้อห้ามที่ AI ควรปฏิบัติตามในการตอบลูกค้า">
    <div className={styles.rules}>
      {settings.rules.map((rule, index) => <div key={rule.id} className={styles.rule}>
        <input aria-label={`กฎของร้าน ข้อ ${index + 1}`} value={rule.text} placeholder="พิมพ์กฎของร้าน" maxLength={500}
          ref={(element) => { if (element) ruleInputs.current.set(rule.id, element); else ruleInputs.current.delete(rule.id); }}
          onChange={(event) => onChange({ rules: settings.rules.map((item) => item.id === rule.id ? { ...item, text: event.target.value } : item) })} />
        <Button type="button" variant="ghost" size="icon" className={styles.deleteRule} aria-label={`ลบกฎของร้าน ข้อ ${index + 1}`}
          onClick={() => removeRule(rule.id)}><Trash2 aria-hidden="true" /></Button>
      </div>)}
    </div>
    <Button id="add-store-rule" type="button" variant="outline" className={styles.addRule} onClick={addRule} disabled={settings.rules.length >= 20}>
      <Plus aria-hidden="true" />เพิ่มกฎของร้าน
    </Button>
  </SettingsSection>;
}

const fallbackOptions = [
  ["notify_and_handoff", "แจ้งลูกค้า และส่งต่อแอดมิน", "แจ้งลูกค้าว่าไม่พบข้อมูล และให้แอดมินช่วยตรวจสอบ"],
  ["handoff_immediately", "ส่งต่อให้แอดมินทันที", "ไม่ตอบลูกค้า และส่งต่อให้แอดมินทันที"],
  ["general_knowledge", "ตอบจากความรู้ทั่วไป", "ใช้ความรู้ทั่วไปในการตอบ (อาจไม่ใช้ข้อมูลของร้าน)"],
] as const;

export function AiFallbackSection({ settings, onChange }: SettingsProps) {
  return <SettingsSection number={4} title="เมื่อ AI ไม่ทราบคำตอบ" description="กำหนดว่า AI ควรทำอย่างไร เมื่อไม่มีข้อมูลในระบบ">
    <fieldset className={`${styles.choiceGroup} ${styles.fallbackGroup}`}>
      <legend className={styles.visuallyHidden}>วิธีตอบเมื่อ AI ไม่ทราบคำตอบ</legend>
      {fallbackOptions.map(([value, title, description]) => <label key={value} className={styles.fallbackOption}>
        <input type="radio" name="fallbackBehavior" value={value} checked={settings.fallbackBehavior === value}
          onChange={() => onChange({ fallbackBehavior: value })} />
        <span><strong>{title}</strong><small>{description}</small></span>
      </label>)}
    </fieldset>
  </SettingsSection>;
}
