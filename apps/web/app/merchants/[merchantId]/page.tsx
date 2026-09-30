import Link from "next/link";
import { LogoutButton } from "../../../components/auth/logout-button";
import { getMyMerchant } from "../../../lib/merchants";
import styles from "../../plain-auth.module.css";

export default async function MerchantPage({ params }: {
  params: Promise<{ merchantId: string }>;
}) {
  const { merchantId } = await params;
  const { merchant, role, owners } = await getMyMerchant(merchantId);
  return (
    <main className={styles.page}>
      <h1>{merchant.shopName}</h1>
      <p>บทบาทของคุณ: {role.name}</p>
      <p>สถานะร้านค้า: {merchant.status}</p>
      <p>Owner: {owners.map(({ user }) => user.name).join(", ")}</p>
      <p><Link href="/merchants">ร้านค้าของฉัน</Link></p>
      <p><Link href="/merchants/new">สร้างร้านค้าเพิ่มเติม</Link></p>
      <LogoutButton />
    </main>
  );
}
