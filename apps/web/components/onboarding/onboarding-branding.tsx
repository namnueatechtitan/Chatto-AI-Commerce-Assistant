import Image from "next/image";
import styles from "../../app/onboarding/onboarding.module.css";
export function OnboardingBranding({ longForm = false }: { longForm?: boolean }) {
  return <section className={`${styles.brandPanel} ${longForm ? styles.longBrandPanel : ""}`} aria-label="Chatto AI Commerce Assistant">
    <div className={styles.brand}><Image src="/images/logo.png" width={284} height={368} sizes="(min-width: 1200px) 3.472222vw, 50px" className={styles.brandIcon} alt="" priority /><div className={styles.wordmark}><p><span>C</span>HAT<span>TO</span></p><p className={styles.tagline}>AI Commerce Assistant</p></div></div>
    <h2 className={styles.brandHeading}><span>AI ผู้ช่วยตอบแชท</span><span>ที่ <strong>เข้าใจร้านของคุณ</strong></span></h2>
    <p className={styles.brandDescription}>จัดการทุกข้อความลูกค้า แนะนำสินค้า ปิดการขายได้ตลอดอัตโนมัติ 24 ชั่วโมง<br className={styles.desktopBreak} />{" "}เพิ่มยอดขายให้ธุรกิจของคุณ</p>
    <div className={styles.heroStage} aria-hidden="true"><span className={`${styles.sparkle} ${styles.sparkleOne}`} /><span className={`${styles.sparkle} ${styles.sparkleTwo}`} /><span className={`${styles.sparkle} ${styles.sparkleThree}`} /><Image src="/images/onboarding/hero.png" width={2068} height={2068} sizes="(max-width: 767px) 0px, 37vw" className={styles.hero} alt="" priority /></div>
  </section>;
}
