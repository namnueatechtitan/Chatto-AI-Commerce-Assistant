import { Card } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";

const conversationRows = [
  ["LINE", "cust_001", "ai_active", "12", "1 minute ago"],
  ["LINE", "cust_002", "handover_requested", "3", "8 minutes ago"],
  ["LINE", "cust_003", "resolved", "9", "45 minutes ago"],
];

export default function ConversationsPage() {
  return (
    <>
      <PageHeader
        title="Conversations"
        description="Conversation history UI scaffold for customer messages and later replay support."
      />

      <Card title="Conversation Monitor">
        <DataTable
          columns={["Channel", "Customer", "Status", "Messages", "Updated"]}
          rows={conversationRows}
        />
      </Card>
    </>
  );
}
