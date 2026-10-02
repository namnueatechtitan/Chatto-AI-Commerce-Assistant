import type { Metadata } from "next";
import Image from "next/image";
import { Noto_Sans_Thai } from "next/font/google";
import { ChartLine } from "lucide-react";
import { Button } from "../../components/ui/Button";
import styles from "./login.module.css";

const thaiFont = Noto_Sans_Thai({
  subsets: ["thai"],
  display: "swap",
  variable: "--font-login-thai",
});

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | Chatto AI Commerce Assistant",
};

const errors: Record<string, string> = {
  line_cancelled: "คุณยกเลิกการเข้าสู่ระบบด้วย LINE สามารถลองใหม่ได้",
  line_failed: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาเริ่มใหม่อีกครั้ง",
  line_not_configured: "ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย LINE กรุณาติดต่อผู้ดูแลระบบ",
  google_cancelled: "คุณยกเลิกการเข้าสู่ระบบด้วย Google สามารถลองใหม่ได้",
  google_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาเริ่มใหม่อีกครั้ง",
  google_not_configured: "ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Google กรุณาติดต่อผู้ดูแลระบบ",
  account_exists: "อีเมลนี้มีบัญชีเดิมที่ยังไม่ได้เชื่อมกับ Google กรุณาติดต่อผู้ดูแลระบบ",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className={`${styles.page} ${thaiFont.variable}`}>
      <section className={styles.illustrationPanel} aria-labelledby="welcome-heading">
        <Image
          className={styles.brand}
          src="/images/logoofull.png"
          alt="Chatto AI Commerce Assistant"
          width={976}
          height={368}
          sizes="244px"
          priority
        />
        <div className={styles.welcome}>
          <p className={styles.welcomeBadge}>
            <span className={styles.wave} aria-hidden="true">👋</span>
            <span>ยินดีต้อนรับสู่ <span className={styles.highlight}>Chatto</span></span>
          </p>
          <h2 id="welcome-heading" className={styles.welcomeHeading}>
            <span>AI ผู้ช่วยตอบแชท</span>
            <span>ที่<span className={styles.highlight}>เข้าใจร้านของคุณ</span></span>
          </h2>
          <p className={styles.welcomeDescription}>
            จัดการทุกข้อความลูกค้า แนะนำสินค้า ปิดการขายได้ตลอดอัติโนมัติ 24 ชั่วโมง<br className={styles.desktopBreak} />{" "}
            เพิ่มยอดขายให้ธุรกิจของคุณ
          </p>
        </div>

        <ul className={styles.benefits} aria-label="จุดเด่นของ Chatto">
          <li className={styles.benefit}>
            <div className={styles.benefitIconSlot}>
              <span className={styles.benefitIcon} aria-hidden="true">
                <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
                  <path fill="currentColor" d="M8 2h16a8 8 0 0 1 8 8v11a8 8 0 0 1-8 8h-5l-3 3-3-3H8a8 8 0 0 1-8-8V10a8 8 0 0 1 8-8Z" />
                  <g fill="white"><circle cx="9" cy="15" r="1.5" /><circle cx="16" cy="15" r="1.5" /><circle cx="23" cy="15" r="1.5" /></g>
                </svg>
              </span>
            </div>
            <p className={styles.benefitTitle}>ตอบลูกค้าอัติโนมัติ 24 ชม.</p>
            <p className={styles.benefitDescription}>ไม่พลาดทุกโอกาสในการขาย</p>
          </li>
          <li className={styles.benefit}>
            <div className={styles.benefitIconSlot}>
              <span className={styles.benefitIcon} aria-hidden="true"><ChartLine size={30} strokeWidth={1.7} /></span>
            </div>
            <p className={styles.benefitTitle}>ตอบลูกค้าอัติโนมัติ 24 ชม.</p>
            <p className={styles.benefitDescription}>ด้วยการแนะนำสินค้าที่ตรงใจ</p>
          </li>
          <li className={styles.benefit}>
            <div className={styles.benefitIconSlot}>
              <span className={styles.benefitIcon} aria-hidden="true">
                <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
                  <path fill="currentColor" d="m16 1 12 5v9c0 8-5 13-12 16C9 28 4 23 4 15V6Z" />
                  <path fill="white" d="M12 13v-2a4 4 0 0 1 8 0v2h1v9H11v-9h1Zm2 0h4v-2a2 2 0 0 0-4 0v2Z" />
                </svg>
              </span>
            </div>
            <p className={styles.benefitTitle}>ปลอดภัย มั่นใจได้</p>
            <p className={styles.benefitDescription}>ข้อมูลปลอดภัย 100%</p>
          </li>
        </ul>

        <div className={styles.heroStage}>
          <Image
            className={styles.hero}
            src="/images/Login/hero.png"
            alt=""
            width={2005}
            height={1136}
            sizes="(max-width: 767px) min(calc(100vw - 48px), 400px), (max-width: 1199px) calc(48.61vw - 48px), 34.72vw"
            priority
          />
        </div>
      </section>

      <section className={styles.authPanel} aria-labelledby="login-heading">
        <div className={styles.authContent}>
          <Image
            className={styles.loginLogo}
            src="/images/logo.png"
            alt=""
            width={284}
            height={368}
            sizes="71px"
            priority
          />
          <h1 id="login-heading" className={styles.heading}>เข้าสู่ระบบ/สมัครสมาชิก</h1>
          <p className={styles.description}>เลือก Google หรือ LINE เพื่อเข้าใช้งาน Chatto</p>

          {error && (
            <p className={styles.error} role="alert">
              {errors[error] || errors.google_failed}
            </p>
          )}

          <div className={styles.providers}>
            <form action="/api/auth/google" method="get">
              <Button className={`${styles.providerButton} ${styles.googleButton}`} variant="outline" type="submit">
                <svg className={styles.providerIcon} viewBox="2 2 20 20" width="30" height="30" aria-hidden="true" focusable="false">
                  <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.89-1.74 2.98-4.3 2.98-7.37Z" />
                  <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.4l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22Z" />
                  <path fill="#FBBC05" d="M6.42 13.92a6 6 0 0 1 0-3.84v-2.6H3.08a10 10 0 0 0 0 9.04l3.34-2.6Z" />
                  <path fill="#EA4335" d="M12 5.96c1.47 0 2.8.51 3.84 1.51l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.92 5.48l3.34 2.6C7.2 7.72 9.4 5.96 12 5.96Z" />
                </svg>
                <span>เข้าสู่ระบบด้วย Google</span>
              </Button>
            </form>
            <form action="/api/auth/line" method="get">
              <Button className={`${styles.providerButton} ${styles.lineButton}`} type="submit">
                <svg className={styles.providerIcon} viewBox="-4 -4 40 40" width="30" height="30" aria-hidden="true" focusable="false">
                  <path fill="white" d="M16 3C8.3 3 2 8.1 2 14.3c0 5.6 5 10.2 11.7 11.1.5.1.8.3.8.7l-.3 2.1c-.1.6.3.8.8.5 2-1 6.8-4.1 9.4-6.9 3.7-3.3 5.6-5.5 5.6-9C30 7.5 23.7 3 16 3Z" />
                  <text x="16" y="17" textAnchor="middle" fill="#06C755" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8">LINE</text>
                </svg>
                <span>เข้าสู่ระบบด้วย LINE</span>
              </Button>
            </form>
          </div>

          <p className={styles.accountHelp}>
            หากใช้งานครั้งแรก <span className={styles.highlight}>ระบบจะสร้างบัญชีให้หลังยืนยันตัวตน</span>{" "}
            หากมีบัญชีแล้วให้เลือกช่องทางที่เคยใช้
          </p>
        </div>
      </section>
    </main>
  );
}
