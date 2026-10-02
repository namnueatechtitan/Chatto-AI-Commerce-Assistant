import Link from "next/link";
import styles from "./onboarding.module.css";

export default function NotFound() {
  return <main className={styles.errorPage}>
    <div className={styles.setupCard}>
      <h1>ไม่พบร้านค้า</h1>
      <p>ไม่พบร้านค้านี้ในบัญชีของคุณ กรุณาเลือกร้านค้าที่คุณมีสิทธิ์เข้าถึง</p>
      <Link className={styles.backLink} href="/onboarding">กลับไปยังการตั้งค่า</Link>
    </div>
  </main>;
}
