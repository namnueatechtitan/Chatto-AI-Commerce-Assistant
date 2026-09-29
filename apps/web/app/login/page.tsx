import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import styles from "../plain-auth.module.css";


const errors: Record<string, string> = {
  google_cancelled: "คุณยกเลิกการเข้าสู่ระบบด้วย Google สามารถลองใหม่ได้",
  google_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาเริ่มใหม่อีกครั้ง",
  account_exists: "อีเมลนี้มีบัญชีเดิมที่ยังไม่ได้เชื่อมกับ Google กรุณาติดต่อผู้ดูแลระบบ",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <main className={styles.page}>
      <h1>เข้าสู่ระบบ</h1>
      <p>เข้าสู่ระบบเพื่อจัดการร้านค้าของคุณ</p>
      {error && <p role="alert">{errors[error] || errors.google_failed}</p>}
      <form action="/api/auth/google" method="get">
        <button type="submit">เข้าสู่ระบบด้วย Google</button>
      </form>
      <p>
        ยังไม่มีบัญชีใช่ไหม? <a href="/api/auth/google">สมัครสมาชิก</a>
      </p>
    </main>
  );
}
