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

export default function DashboardPage() {
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {dashboardStats.map((stat) => {
          const Icon = statIconMap[stat.icon];

          return <StatCard key={stat.label} icon={Icon} stat={stat} />;
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <MessageOverviewChart
          className="xl:col-span-5"
          data={messageOverviewData}
          periodLabel={dashboardOverview.periodLabel}
        />
        <ChannelDistributionChart
          className="xl:col-span-3"
          data={channelDistributionData}
          totalMessages="25,680"
        />
        <AIKnowledgeCard
          className="xl:col-span-2"
          metrics={aiKnowledgeMetrics}
        />
        <AIPerformanceCard
          className="xl:col-span-2"
          metrics={aiPerformanceMetrics}
          periodLabel={dashboardOverview.periodLabel}
        />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[0.92fr_0.92fr_1.24fr_0.96fr]">
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

      <FooterBanner benefits={footerBenefits} />
    </div>
  );
}
