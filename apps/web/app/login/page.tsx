import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import styles from "../plain-auth.module.css";


const errors: Record<string, string> = {
  line_cancelled: "คุณยกเลิกการเข้าสู่ระบบด้วย LINE สามารถลองใหม่ได้",
  line_failed: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาเริ่มใหม่อีกครั้ง",
  line_not_configured: "ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย LINE กรุณาติดต่อผู้ดูแลระบบ",
  google_cancelled: "คุณยกเลิกการเข้าสู่ระบบด้วย Google สามารถลองใหม่ได้",
  google_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาเริ่มใหม่อีกครั้ง",
  account_exists: "อีเมลนี้มีบัญชีเดิมที่ยังไม่ได้เชื่อมกับ Google กรุณาติดต่อผู้ดูแลระบบ",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/merchants");
  const { error } = await searchParams;
  return (
    <main className={styles.page}>
      <h1>เข้าสู่ระบบ / สมัครสมาชิก</h1>
      <p>เลือก Google หรือ LINE เพื่อเข้าใช้งาน Chatto</p>
      {error && <p role="alert">{errors[error] || errors.google_failed}</p>}
      <form action="/api/auth/google" method="get">
        <button type="submit">เข้าสู่ระบบ / สมัครด้วย Google</button>
      </form>
      <form action="/api/auth/line" method="get">
        <button type="submit">เข้าสู่ระบบ / สมัครด้วย LINE</button>
      </form>
      <p>
        หากใช้งานครั้งแรก ระบบจะสร้างบัญชีให้หลังยืนยันตัวตน หากมีบัญชีแล้ว ให้เลือกช่องทางเดิมที่เคยใช้
      </p>
    </main>
  );
}
