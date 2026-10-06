import Link from "next/link";
import { notFound } from "next/navigation";
import { MerchantAiControl } from "../../../components/dashboard/merchant-ai-control";
import { getMyMerchants } from "../../../lib/merchants";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ merchantId?: string | string[] }> }) {
  const memberships = await getMyMerchants();
  const { merchantId } = await searchParams;
  const selected = typeof merchantId === "string" ? memberships.find(item => item.merchant.id === merchantId)
    : merchantId === undefined && memberships.length === 1 ? memberships[0] : undefined;
  if (merchantId !== undefined && !selected) notFound();
  return (
    <>
      <PageHeader
        title="ตั้งค่าร้านค้า"
        description={selected ? selected.merchant.shopName : "เลือกร้านที่ต้องการตั้งค่าการตอบ AI"}
      />

      <Card title="การตอบอัตโนมัติของ AI">
        {selected ? <MerchantAiControl key={selected.merchant.id} merchantId={selected.merchant.id}
          canEdit={selected.role.name === "Owner" && ["ACTIVE", "TRIAL"].includes(selected.merchant.status)} />
          : <ul className="content-stack">{memberships.map(({ merchant }) => <li key={merchant.id}><Link className="text-primary underline" href={`/dashboard/settings?merchantId=${encodeURIComponent(merchant.id)}`}>{merchant.shopName}</Link></li>)}</ul>}
      </Card>
    </>
  );
}
