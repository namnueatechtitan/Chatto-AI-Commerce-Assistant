import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OnboardingBranding } from "../../../components/onboarding/onboarding-branding";
import { StoreInformationForm } from "../../../components/onboarding/store-information-form";
import { getOnboardingStatus, onboardingHref } from "../../../lib/onboarding";
import { getStoreInformation } from "../../../lib/store-information";
import base from "../onboarding.module.css";
import styles from "../../../components/onboarding/store-information-form.module.css";

export default async function StoreSetupPage({ searchParams }: { searchParams: Promise<{ merchantId?: string }> }) {
  const { merchantId } = await searchParams;
  const status = await getOnboardingStatus(merchantId);
  const selected = status.merchant;
  const initial = selected ? await getStoreInformation(selected.id) : undefined;
  return <main className={`${base.page} ${styles.page}`}><OnboardingBranding longForm /><section className={styles.panel} aria-label="เพิ่มข้อมูลร้าน">
    <Link className={styles.back} href={onboardingHref("/onboarding", selected?.id)}><ArrowLeft size={15} aria-hidden="true" />กลับไปยังการตั้งค่า</Link>
    <span className={styles.badge}>ขั้นตอนที่ 3 จาก 6</span>
    <header className={styles.intro}><h1>เพิ่มข้อมูลร้าน</h1><p>กรอกข้อมูลพื้นฐานของร้าน คำถามที่พบบ่อย และรายละเอียดสินค้า เพื่อให้ Chatto นำไปใช้ตอบลูกค้าแทนคุณ</p></header>
    {status.memberships.length > 1 && !selected ? <div className={styles.card}><h2>เลือกร้านที่ต้องการแก้ไข</h2>{status.memberships.map(({ merchant }) => <p key={merchant.id}><Link className={styles.back} href={onboardingHref("/onboarding/store", merchant.id)}>{merchant.shopName}</Link></p>)}</div> : <StoreInformationForm initial={initial} />}
  </section></main>;
}
