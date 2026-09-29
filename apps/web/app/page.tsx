import styles from "./plain-auth.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <form action="/login" method="get">
        <button type="submit">เข้าสู่ระบบ</button>
      </form>
    </main>
  );
}
