/**
 * หน้าที่ไฟล์: ไฟล์นี้เป็นหน้าส่งต่อแชตให้ทีมงานและทำหน้าที่ประกอบคอมโพเนนต์หลักที่ใช้แสดงผลในเส้นทางนี้
 */

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";

/**
 * หน้าที่: คอมโพเนนต์หน้านี้เรนเดอร์หน้าส่งต่อแชตให้ทีมงานและประกอบส่วนย่อยที่เกี่ยวข้อง
 */
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
