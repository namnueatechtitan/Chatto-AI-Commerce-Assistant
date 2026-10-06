"use client";
import { ArrowLeft, LockKeyhole, Search, Send, Star, UserRound } from "lucide-react";
import { useState } from "react";
import { dashboardTime, filterDashboardMessages, type DashboardConversation, type ConversationOwnership } from "../../lib/dashboard-model";
import { LiveMessagesEmpty } from "./LiveMessagesEmpty";
import styles from "./merchant-dashboard.module.css";

export function CustomerAvatar({ message }: { message: DashboardConversation }) {
  const [failed, setFailed] = useState(false);
  const source = message.customerAvatar?.startsWith("https://") ? message.customerAvatar : null;
  return <span className={styles.customerAvatar} aria-hidden="true">{source && !failed
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={source} alt="" width={40} height={40} referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <UserRound size={22} />}</span>;
}
const ownershipText = { AI: "AI ดูแลอยู่", WAITING_HANDOVER: "รอรับช่วงต่อ", HUMAN: "แอดมินดูแลอยู่" };
export function OwnershipBadge({ ownership }: { ownership?: ConversationOwnership }) {
  return ownership ? <span className={`${styles.badge} ${ownership === "WAITING_HANDOVER" ? styles.warning : ownership === "HUMAN" ? styles.admin : styles.connected}`}>{ownershipText[ownership]}</span> : null;
}

function ConversationPanel({ message, merchantName, preview, onBack }: { message: DashboardConversation; merchantName: string; preview: boolean; onBack: () => void }) {
  // TODO: Connect an authenticated, merchant-scoped handover/send API when available.
  // Ownership and favorites below are preview-only; real messages stay read-only.
  const [ownership, setOwnership] = useState(message.ownership ?? "AI");
  const [favorite, setFavorite] = useState(false), [draft, setDraft] = useState(""), [feedback, setFeedback] = useState(false);
  const canCompose = preview && ownership === "HUMAN";
  return <section className={styles.chatPanel} aria-label="ข้อความที่เลือก">
    <header className={styles.chatHeader}>
      <button className={`${styles.iconButton} ${styles.mobileBack}`} aria-label="กลับไปรายการข้อความ" onClick={onBack}><ArrowLeft size={18} /></button>
      <CustomerAvatar message={message} /><div className={styles.customerHeading}><strong>{message.customerName}</strong><span><span className={styles.lineBadge}>LINE</span> <small>#{message.id.slice(-8)}</small></span></div>
      <OwnershipBadge ownership={preview ? ownership : undefined} />
      <button className={styles.iconButton} aria-label="แชทโปรด" aria-pressed={favorite} disabled={!preview} onClick={() => setFavorite(value => !value)}><Star size={18} fill={favorite ? "currentColor" : "none"} /></button>
      <button className={styles.primaryButton} disabled={!preview || ownership === "HUMAN"} onClick={() => setOwnership("HUMAN")}>{ownership === "HUMAN" ? "รับช่วงต่อแล้ว" : "รับช่วงต่อ"}</button>
    </header>
    <div className={styles.chatBody}>
      <p className={styles.dateLabel}>{preview ? "แชทตัวอย่าง" : "ข้อความลูกค้าล่าสุด · ไม่ใช่ประวัติแชททั้งหมด"}</p>
      <div className={styles.inbound}><span>{message.customerName}</span><p>{message.message}</p><time dateTime={message.timestamp}>{dashboardTime(message.timestamp)}</time></div>
      {preview && message.previewReplies?.map(reply => <div className={styles.outbound} key={reply.timestamp}><span>{merchantName} · ตัวอย่าง</span><p>{reply.text}</p><time dateTime={reply.timestamp}>{dashboardTime(reply.timestamp)}</time></div>)}
    </div>
    <form className={styles.composer} onSubmit={event => { event.preventDefault(); if (canCompose && draft.trim()) setFeedback(true); }}>
      <label htmlFor="chat-draft"><LockKeyhole size={15} aria-hidden="true" />{canCompose ? "พิมพ์ข้อความตัวอย่าง (ไม่ส่งจริง)" : "รับช่วงต่อก่อน เพื่อพิมพ์ตอบลูกค้า"}</label>
      <textarea id="chat-draft" rows={2} disabled={!canCompose} value={draft} onChange={event => { setDraft(event.target.value); setFeedback(false); }} placeholder={canCompose ? "พิมพ์ข้อความ…" : "การตอบด้วยแอดมินยังไม่พร้อมใช้งาน"} />
      <div><small>{preview ? "โหมดตัวอย่าง ไม่ส่งข้อความไป LINE" : "ยังไม่มี API รับช่วงต่อและส่งข้อความของแอดมิน"}</small><button className={styles.primaryButton} type="submit" disabled={!canCompose || !draft.trim()}>{preview ? "ทดลองส่ง" : "ส่ง"}<Send size={15} /></button></div>
      {feedback && <p role="status">ตัวอย่างเท่านั้น ยังไม่ได้ส่งข้อความ</p>}
    </form>
  </section>;
}

export function ConversationWorkspace({ messages, merchantName, preview, initialSelection }: { messages: DashboardConversation[]; merchantName: string; preview: boolean; initialSelection?: string | null }) {
  const [selectedId, setSelectedId] = useState(initialSelection ?? messages[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(false), [search, setSearch] = useState(""), [waitingOnly, setWaitingOnly] = useState(false);
  const filtered = filterDashboardMessages(messages, search, waitingOnly);
  const selected = filtered.find(message => message.id === selectedId) ?? filtered[0];
  return <div className={`${styles.workspace} ${detailOpen && selected ? styles.detailOpen : ""}`} data-preview={preview}>
    <section className={styles.conversationList} aria-label="รายการข้อความลูกค้า">
      <div className={styles.tabs} role="group" aria-label="กรองข้อความ">
        <button aria-pressed={!waitingOnly} onClick={() => setWaitingOnly(false)}>ทั้งหมด ({messages.length})</button>
        {preview && <button aria-pressed={waitingOnly} onClick={() => setWaitingOnly(true)}>รอรับช่วงต่อ ({messages.filter(message => message.ownership === "WAITING_HANDOVER").length})</button>}
      </div>
      <label className={styles.search}><Search size={15} aria-hidden="true" /><input aria-label="ค้นหาลูกค้าหรือข้อความ" placeholder="ชื่อลูกค้า หรือข้อความ" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className={styles.listRows}>{filtered.length ? filtered.map(message => <button className={`${styles.conversationRow} ${selected?.id === message.id ? styles.selectedRow : ""}`} key={message.id} aria-pressed={selected?.id === message.id} onClick={() => { setSelectedId(message.id); setDetailOpen(true); }}>
        <CustomerAvatar message={message} /><span className={styles.rowContent}><span><strong>{message.customerName}</strong><time dateTime={message.timestamp}>{dashboardTime(message.timestamp)}</time></span><span className={styles.messagePreview}>{message.message}</span><span><span className={styles.lineBadge}>LINE</span><OwnershipBadge ownership={preview ? message.ownership : undefined} /></span></span>
      </button>) : <p className={styles.empty}>ไม่พบข้อความที่ค้นหา</p>}</div>
    </section>
    {selected ? <ConversationPanel key={`${preview}:${selected.id}`} message={selected} merchantName={merchantName} preview={preview} onBack={() => setDetailOpen(false)} /> : <LiveMessagesEmpty />}
  </div>;
}
