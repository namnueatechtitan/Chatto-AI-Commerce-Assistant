import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "../../components/auth/logout-button";
import { getMyMerchants } from "../../lib/merchants";
import styles from "../plain-auth.module.css";

export default async function MerchantsPage() {
  const memberships = await getMyMerchants();
  if (memberships.length === 0) redirect("/onboarding");
  if (memberships.length === 1) redirect(`/onboarding?merchantId=${memberships[0]!.merchant.id}`);
  return (
    <main className={styles.page}>
      <h1>เลือกร้านค้า</h1>
      <ul>
        {memberships.map(({ merchant, role }) => (
          <li key={merchant.id}>
            <Link href={`/onboarding?merchantId=${merchant.id}`}>{merchant.shopName}</Link> ({role.name})
          </li>
        ))}
      </ul>
      <Link href="/merchants/new">สร้างร้านค้า</Link>
      <LogoutButton />
    </main>
  );
}
