import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { PageHeader } from "../../components/ui/PageHeader";

const recentConversationRows = [
  ["C-10021", "General question", "AI Active", "2 minutes ago"],
  ["C-10020", "Product availability", "Handover Requested", "12 minutes ago"],
  ["C-10019", "Shipping FAQ", "Resolved", "1 hour ago"],
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A lightweight merchant overview for the Phase 2 foundation."
      />

      <section className="card-grid">
        <Card title="Total Customers">
          <div className="metric-value">128</div>
          <div className="metric-subtitle">Stored customer profiles scaffold</div>
        </Card>
        <Card title="Total Messages">
          <div className="metric-value">3,214</div>
          <div className="metric-subtitle">Conversation message storage preview</div>
        </Card>
        <Card title="Total Products">
          <div className="metric-value">42</div>
          <div className="metric-subtitle">Merchant product catalog placeholder</div>
        </Card>
        <Card title="Recent Conversations">
          <div className="metric-value">7</div>
          <div className="metric-subtitle">Open or active conversations today</div>
        </Card>
      </section>

      <Card title="Recent Conversations">
        <DataTable
          columns={["Conversation", "Intent", "Status", "Updated"]}
          rows={recentConversationRows}
        />
      </Card>
    </>
  );
}
