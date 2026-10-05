import {
  CircleDollarSign,
  MessageCircleMore,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react";

import { AIAssistantPanel } from "../../components/dashboard/ai-assistant-panel";
import { AIKnowledgeCard } from "../../components/dashboard/ai-knowledge-card";
import { AIPerformanceCard } from "../../components/dashboard/ai-performance-card";
import { ChannelDistributionChart } from "../../components/dashboard/channel-distribution-chart";
import { CustomerIssuesCard } from "../../components/dashboard/customer-issues-card";
import { FooterBanner } from "../../components/dashboard/footer-banner";
import { LiveMessagesFeed } from "../../components/dashboard/LiveMessagesFeed";
import { MessageOverviewChart } from "../../components/dashboard/message-overview-chart";
import { RecentOrdersCard } from "../../components/dashboard/recent-orders-card";
import { StatCard } from "../../components/dashboard/stat-card";
import { TopProductsCard } from "../../components/dashboard/top-products-card";
import { WelcomeBanner } from "../../components/dashboard/welcome-banner";
import {
  aiKnowledgeMetrics,
  aiPerformanceMetrics,
  assistantHighlights,
  assistantWidgets,
  channelDistributionData,
  customerIssueCategories,
  customerIssueMetrics,
  dashboardOverview,
  dashboardStats,
  footerBenefits,
  messageOverviewData,
  recentOrders,
  topProducts,
  type DashboardStatIcon,
} from "../../lib/mock-data";
import { getMyMerchants } from "../../lib/merchants";

export default async function DashboardPage({ searchParams }: {
  searchParams: Promise<{ merchantId?: string | string[] }>;
}) {
  const memberships = await getMyMerchants();
  const { merchantId } = await searchParams;
  const selected = typeof merchantId === "string"
    ? memberships.find(({ merchant }) => merchant.id === merchantId)
    : merchantId === undefined && memberships.length === 1 ? memberships[0] : undefined;
  const statIconMap: Record<
    DashboardStatIcon,
    typeof MessageCircleMore
  > = {
    messages: MessageCircleMore,
    customers: Users,
    orders: ShoppingCart,
    revenue: CircleDollarSign,
    conversion: TrendingUp,
    issues: TriangleAlert,
  };

  return (
    <div className="space-y-6">
      <WelcomeBanner
        greeting={dashboardOverview.greeting}
        inventoryAlert={dashboardOverview.inventoryAlert}
        storeSummary={dashboardOverview.storeSummary}
      />

      <section className="grid gap-4 sm:grid-cols-2 desktop:grid-cols-3">
        {dashboardStats.map((stat) => {
          const Icon = statIconMap[stat.icon];

          return <StatCard key={stat.label} icon={Icon} stat={stat} />;
        })}
      </section>

      <section className="grid gap-4 desktop:grid-cols-12">
        <MessageOverviewChart
          className="desktop:col-span-5"
          data={messageOverviewData}
          periodLabel={dashboardOverview.periodLabel}
        />
        <ChannelDistributionChart
          className="desktop:col-span-3"
          data={channelDistributionData}
          totalMessages="25,680"
        />
        <AIKnowledgeCard
          className="desktop:col-span-2"
          metrics={aiKnowledgeMetrics}
        />
        <AIPerformanceCard
          className="desktop:col-span-2"
          metrics={aiPerformanceMetrics}
          periodLabel={dashboardOverview.periodLabel}
        />
      </section>

      <section className="grid items-start gap-4 desktop:grid-cols-[0.92fr_0.92fr_1.24fr_0.96fr]">
        <TopProductsCard products={topProducts} />
        <RecentOrdersCard orders={recentOrders} />
        <CustomerIssuesCard
          categories={customerIssueCategories}
          metrics={customerIssueMetrics}
        />
        <AIAssistantPanel
          highlights={assistantHighlights}
          widgets={assistantWidgets}
        />
      </section>

      <section>
        <LiveMessagesFeed
          key={selected?.merchant.id ?? "unselected"}
          merchants={memberships.map(({ merchant }) => merchant)}
          selectedMerchantId={selected?.merchant.id ?? null}
          invalidSelection={merchantId !== undefined && !selected}
        />
      </section>

      <FooterBanner benefits={footerBenefits} />
    </div>
  );
}
