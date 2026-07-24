/**
 * หน้าที่ไฟล์: ไฟล์นี้เป็นหน้ารายการบทสนทนาและทำหน้าที่ประกอบคอมโพเนนต์หลักที่ใช้แสดงผลในเส้นทางนี้
 */

import { Card } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";

const conversationRows = [
  ["LINE", "cust_001", "ai_active", "12", "1 minute ago"],
  ["LINE", "cust_002", "handover_requested", "3", "8 minutes ago"],
  ["LINE", "cust_003", "resolved", "9", "45 minutes ago"],
];

/**
 * หน้าที่: คอมโพเนนต์หน้านี้เรนเดอร์หน้ารายการบทสนทนาและประกอบส่วนย่อยที่เกี่ยวข้อง
 */
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
