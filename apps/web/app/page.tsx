import styles from "./plain-auth.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <a href="/login">เข้าสู่ระบบ</a>
    </main>
  );
}
