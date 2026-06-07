import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";

export default function HandoverPage() {
  return (
    <>
      <PageHeader
        title="Handover"
        description="Scaffold for agent visibility into tickets, assignments, and handover messages."
        actions={<Button variant="secondary">Create Test Ticket</Button>}
      />

      <Card title="Agent Inbox">
        <EmptyState
          title="No active handover tickets yet"
          description="This section will display open tickets, latest handover messages, and assignment status once the Phase 2.6 handover flow is wired."
        />
      </Card>
    </>
  );
}
