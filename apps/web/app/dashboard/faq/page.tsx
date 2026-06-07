import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";

const faqRows = [
  ["Shipping Policy", "active", "Manual", "Updated today"],
  ["Refund Rules", "outdated", "Imported", "Updated 5 days ago"],
];

export default function FaqPage() {
  return (
    <>
      <PageHeader
        title="FAQ / Knowledge"
        description="Merchant-owned FAQ and knowledge document scaffold for AI context building."
        actions={<Button>Add Document</Button>}
      />

      <Card title="Knowledge Documents">
        <DataTable
          columns={["Document", "Status", "Source", "Last Updated"]}
          rows={faqRows}
        />
      </Card>
    </>
  );
}
