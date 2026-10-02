"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogJob } from "../../lib/store-information-types";
import styles from "./store-information-form.module.css";

export function CatalogImport({ merchantId, saveForUpload, disabled }: { merchantId?: string; saveForUpload: () => Promise<string | null>; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [job, setJob] = useState<CatalogJob | null>(null);
  const [history, setHistory] = useState<CatalogJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const request = useCallback(async (path: string, method = "GET"): Promise<{ import: CatalogJob; imports: CatalogJob[] }> => {
    const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(35000) });
    if (response.status === 401) { window.location.assign("/login"); throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง"); }
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : "ไม่สามารถโหลดการนำเข้าได้ กรุณาลองอีกครั้ง");
    return result;
  }, []);
  const refreshHistory = useCallback(async () => {
    if (!merchantId) return;
    setHistory((await request(`/api/merchants/${merchantId}/catalog-imports`)).imports);
  }, [merchantId, request]);
  useEffect(() => { void refreshHistory().catch((error: unknown) => setError(error instanceof Error ? error.message : "โหลดประวัติไม่สำเร็จ")); }, [refreshHistory]);
  useEffect(() => {
    if (job?.status !== "PARSING") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void request(`/api/merchants/${job.merchantId}/catalog-imports/${job.id}`).then((result) => { if (!cancelled) { setJob(result.import); setError(""); } }).catch((error: unknown) => { if (!cancelled) setError(error instanceof Error ? error.message : "โหลดสถานะไม่สำเร็จ"); });
    }, 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [job?.id, job?.merchantId, job?.status, request]);
  const upload = async (file: File) => {
    if (busyRef.current || disabled || job?.status === "PARSING") return;
    if (!/\.(csv|xlsx|pdf)$/i.test(file.name) || file.size > 5 * 1024 * 1024 || file.size === 0) { setError("เลือกไฟล์ CSV, XLSX หรือ PDF ขนาดไม่เกิน 5 MB"); return; }
    busyRef.current = true; setBusy(true); setError(""); setUploadProgress(0);
    try {
      const id = await saveForUpload(); if (!id) return;
      const result = await new Promise<CatalogJob>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhr.open("POST", `/api/merchants/${id}/catalog-imports`); xhr.timeout = 30000;
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploadProgress(Math.round(event.loaded / event.total * 100)); };
        xhr.onerror = () => reject(new Error("อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง"));
        xhr.ontimeout = () => reject(new Error("การอัปโหลดหมดเวลา ลองอัปโหลดไฟล์เดิมอีกครั้ง"));
        xhr.onload = () => {
          if (xhr.status === 401) { window.location.assign("/login"); reject(new Error("กรุณาเข้าสู่ระบบอีกครั้ง")); return; }
          try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(data.import as CatalogJob); else reject(new Error(typeof data.message === "string" ? data.message : "อัปโหลดไม่สำเร็จ")); } catch { reject(new Error("อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง")); }
        };
        const body = new FormData(); body.append("file", file); xhr.send(body);
      });
      setJob(result); await refreshHistory();
    } catch (error) { setError(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ"); }
    finally { busyRef.current = false; setBusy(false); if (input.current) input.current.value = ""; }
  };
  const action = async (action: "confirm" | "cancel") => {
    if (!job || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { setJob((await request(`/api/merchants/${job.merchantId}/catalog-imports/${job.id}/${action}`, "POST")).import); await refreshHistory(); }
    catch (error) { setError(error instanceof Error ? error.message : "การนำเข้าไม่สำเร็จ"); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <section className={styles.card} aria-labelledby="catalog-heading">
    <h2 id="catalog-heading">ไฟล์ข้อมูลสินค้า (ถ้ามี)</h2><p className={styles.hint}>อัปโหลดแคตตาล็อกเพื่อเตรียมข้อมูลสินค้า ตรวจสอบตัวอย่างก่อนยืนยันนำเข้า</p>
    <div className={`${styles.drop} ${dragging ? styles.dropActive : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files[0]) void upload(event.dataTransfer.files[0]); }}>
      <input ref={input} type="file" accept=".csv,.xlsx,.pdf" hidden onChange={(event) => { if (event.target.files?.[0]) void upload(event.target.files[0]); }} />
      <button type="button" className={styles.choose} onClick={() => input.current?.click()} disabled={disabled || busy || job?.status === "PARSING"}>Drag a file here, or<span>Choose a file to upload</span><span>CSV · XLSX · PDF / ไม่เกิน 5 MB</span></button>
    </div>
    <p className={styles.hint}>{merchantId ? "สูงสุด 500 สินค้า / PDF 20 หน้า ไม่รองรับ OCR" : "กรอกชื่อร้าน หมวดหมู่ และเวลาทำการก่อนอัปโหลด ระบบจะบันทึกข้อมูลร้านและ FAQ ที่กรอกครบให้"}</p>
    <div className={styles.templates}><a href={merchantId ? `/api/merchants/${merchantId}/catalog-imports/template/csv` : "/templates/catalog.csv"}>ดาวน์โหลดตัวอย่าง CSV</a><a href={merchantId ? `/api/merchants/${merchantId}/catalog-imports/template/xlsx` : "/templates/catalog.xlsx"}>ดาวน์โหลดตัวอย่าง XLSX</a></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {busy && <div className={styles.uploadMeta} aria-live="polite"><span>กำลังดำเนินการ {uploadProgress}%</span><progress aria-label="ความคืบหน้าการอัปโหลด" value={uploadProgress} max={100} /></div>}
    {job && <div className={styles.uploadMeta} aria-live="polite"><h3>{job.originalName}</h3>
      {job.status === "PARSING" && <p className={styles.hint}>กำลังอ่านไฟล์… ยังไม่มีสินค้าถูกนำเข้า</p>}
      {job.error && <p className={styles.error}>{job.error}</p>}
      {job.status === "FAILED" && <p className={styles.hint}>ไม่ได้นำเข้าสินค้า เลือกไฟล์ที่แก้ไขแล้วหรืออัปโหลดไฟล์เดิมเพื่อลองใหม่</p>}
      {job.status === "CANCELLED" && <p className={styles.hint}>ยกเลิกแล้ว ไม่ได้นำเข้าสินค้า</p>}
      {job.status === "IMPORTED" && <p className={styles.notice}>นำเข้าเสร็จแล้ว: เพิ่ม {job.createdCount} · อัปเดต {job.updatedCount} · ข้ามแถวที่มีข้อผิดพลาด {job.rejectedCount}</p>}
      {job.status === "PREVIEW" && job.preview && <><p className={styles.hint}>พร้อมนำเข้า {job.preview.validCount} จาก {job.preview.rows.length} แถว · แถวที่มีข้อผิดพลาดจะถูกข้าม · ชื่อสินค้าที่ตรงกันจะอัปเดตข้อมูลเดิม</p>
        <p className={styles.hint}>คอลัมน์ที่ส่งมา: {job.preview.fields.join(", ")} · ช่องที่เว้นว่างจะล้างข้อมูลเฉพาะคอลัมน์นั้น</p>
        {job.preview.warnings.map((warning) => <p className={styles.hint} key={warning}>{warning}</p>)}
        <div className={styles.preview} tabIndex={0} role="region" aria-label="ตัวอย่างข้อมูลสินค้า"><table><thead><tr><th>แถว</th><th>สินค้า</th><th>รายละเอียด / หมวดหมู่ / แบรนด์</th><th>ผลตรวจสอบ</th></tr></thead><tbody>{job.preview.rows.map((row) => <tr key={row.row}><td>{row.row}</td><td>{row.product.name || "—"}</td><td>{[row.product.description, row.product.category, row.product.brand].filter(Boolean).join(" / ") || "—"}</td><td className={row.errors.length ? styles.error : ""}>{[...row.errors, ...row.warnings].join(" ") || "ผ่าน"}</td></tr>)}</tbody></table></div>
        <div className={styles.importActions}><button type="button" className={styles.primary} disabled={disabled || busy || !job.preview.validCount} onClick={() => void action("confirm")}>ยืนยันนำเข้า {job.preview.validCount} สินค้า</button><button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => void action("cancel")}>ยกเลิกการนำเข้า</button></div></>}
      {job.status === "PARSING" && <button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => void action("cancel")}>ยกเลิกการอ่านไฟล์</button>}
    </div>}
    {history.length > 0 && <details className={styles.history}><summary>ประวัติการนำเข้า ({history.length})</summary>{history.map((item) => <button key={item.id} type="button" onClick={() => { void request(`/api/merchants/${item.merchantId}/catalog-imports/${item.id}`).then((result) => setJob(result.import)).catch((error: unknown) => setError(error instanceof Error ? error.message : "โหลดไม่สำเร็จ")); }}>{item.originalName} · {item.status}</button>)}</details>}
  </section>;
}
