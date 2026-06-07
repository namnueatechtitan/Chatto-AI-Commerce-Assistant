import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";

const productRows = [
  ["Starter Bundle", "active", "4 variants", "Updated 1 day ago"],
  ["Signature Blend", "draft", "2 variants", "Updated 3 days ago"],
];

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Products"
        description="Phase 2 product management placeholder for merchant catalog data."
        actions={<Button>Add Product</Button>}
      />

      <Card title="Product List">
        <DataTable
          columns={["Product", "Status", "Variants", "Last Updated"]}
          rows={productRows}
        />
      </Card>
    </>
  );
}
