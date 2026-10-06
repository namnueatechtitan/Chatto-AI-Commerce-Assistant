"use client";
import { RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDashboardReadiness } from "../../hooks/use-dashboard-readiness";
import { useLatestMessages } from "../../hooks/useLatestMessages";
import { messageTrend, previewConversations, previewOrders } from "../../lib/dashboard.mock";
import { useDashboardMerchant } from "./dashboard-shell";
import { DashboardWelcome, BusinessMetricStrip, HandoverQueueCard, LineChannelCard } from "./dashboard-overview";
import { ConversationWorkspace } from "./conversation-workspace";
import { MessageOverviewChart } from "./message-overview-chart";
import { RecentOrdersCard } from "./recent-orders-card";
import { SystemStatusGrid } from "./system-status-grid";
import { LiveMessagesEmpty } from "./LiveMessagesEmpty";
import { LiveMessagesError } from "./LiveMessagesError";
import { LiveMessagesSkeleton } from "./LiveMessagesSkeleton";
import styles from "./merchant-dashboard.module.css";

export function MerchantOwnerDashboard() {
  const { memberships, selected, invalidSelection, selectMerchant } = useDashboardMerchant();
  const merchantId = selected?.merchant.id ?? null;
  const { readiness, loading, error, refresh } = useDashboardReadiness(merchantId);
  const feed = useLatestMessages(merchantId);
  const router = useRouter(), params = useSearchParams();
  const preview = params.get("preview") === "1";
  function previewRoute(id?: string) {
    const query = new URLSearchParams(params.toString()); query.delete("activation");
    if (id) { query.set("preview", "1"); query.set("conversation", id); }
    else if (preview) { query.delete("preview"); query.delete("conversation"); }
    else query.set("preview", "1");
    router.replace(`/dashboard${query.size ? `?${query}` : ""}`, { scroll: false });
  }
  const success = params.get("activation") === "success" && readiness?.aiEnabled === true && readiness.ready;
  return <div className={styles.dashboard}>
    {success && <div className={styles.success} role="status" aria-live="polite"><strong>เปิดใช้งาน AI สำเร็จ</strong><p>AI พร้อมตอบข้อความลูกค้าผ่าน LINE OA แล้ว</p></div>}
    <DashboardWelcome merchantName={selected?.merchant.shopName} />
    <div className={styles.merchantBar}><label htmlFor="messages-merchant">ร้านค้า</label><select id="messages-merchant" value={merchantId ?? ""} onChange={event => selectMerchant(event.target.value)}><option value="">เลือกร้านค้า</option>{memberships.map(({ merchant }) => <option value={merchant.id} key={merchant.id}>{merchant.shopName}</option>)}</select><span className={styles.muted}>ยอดขาย กราฟ และคำสั่งซื้อเป็นข้อมูลตัวอย่าง</span></div>
    {invalidSelection && <p role="alert" className={styles.error}>ไม่พบร้านค้าหรือคุณไม่มีสิทธิ์ดูข้อความของร้านนี้ กรุณาเลือกร้านค้า</p>}
    {error && <div role="alert" className={styles.error}>{error}<button className={styles.outlineButton} onClick={refresh}>ลองใหม่</button></div>}
    <BusinessMetricStrip />
    <section className={styles.overviewGrid} aria-label="ภาพรวมการทำงาน"><MessageOverviewChart data={messageTrend} periodLabel="7 วันที่ผ่านมา" className={styles.trendCard} /><LineChannelCard readiness={readiness} merchantName={selected?.merchant.shopName} loading={loading} error={!!error} messageCount={!merchantId || feed.isLoading || feed.error ? null : feed.messages.length} /><HandoverQueueCard openPreview={previewRoute} /></section>
    <section aria-labelledby="workspace-heading">
      <div className={styles.workspaceHeading}><h2 id="workspace-heading">{preview ? "พื้นที่แชทตัวอย่าง" : "ข้อความล่าสุด"}</h2><div><button className={styles.outlineButton} disabled={!merchantId || feed.requiresLogin} onClick={feed.refresh}><RefreshCw size={14} aria-hidden="true" />Refresh</button><button className={styles.outlineButton} onClick={() => previewRoute()}>{preview ? "กลับไปข้อความจริง" : "ดูตัวอย่างหน้าตา"}</button></div></div>
      {preview && <p role="status" className={styles.previewNotice}>ข้อมูลตัวอย่างเท่านั้น การรับช่วงต่อและการพิมพ์ไม่เปลี่ยนแชทจริงหรือส่งข้อความไป LINE</p>}
      <div className={styles.operationsGrid}>
        <div className={styles.operationsMain}>{preview ? <ConversationWorkspace key={`${merchantId}:preview:${params.get("conversation") ?? ""}`} messages={previewConversations} merchantName={selected?.merchant.shopName ?? "ร้านค้าตัวอย่าง"} preview initialSelection={params.get("conversation")} />
          : !merchantId ? <p role="status" className={styles.empty}>เลือกร้านค้าก่อนดูข้อความล่าสุด</p>
          : feed.isLoading ? <div className={styles.loading} role="status" aria-label="กำลังโหลดข้อความ"><LiveMessagesSkeleton /></div>
          : feed.error ? <LiveMessagesError onRetry={feed.refresh} message={feed.error} requiresLogin={feed.requiresLogin} />
          : feed.messages.length === 0 ? <LiveMessagesEmpty />
          : <ConversationWorkspace key={`${merchantId}:live`} messages={feed.messages} merchantName={selected!.merchant.shopName} preview={false} />}</div>
        <RecentOrdersCard orders={previewOrders} className={styles.ordersCard} preview />
      </div>
    </section>
    <SystemStatusGrid readiness={readiness} merchantId={merchantId} loading={loading} error={error} refresh={refresh} />
  </div>;
}
