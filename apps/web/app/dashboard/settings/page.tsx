/**
 * หน้าที่ไฟล์: ไฟล์นี้เป็นหน้าตั้งค่าระบบและทำหน้าที่ประกอบคอมโพเนนต์หลักที่ใช้แสดงผลในเส้นทางนี้
 */

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";

/**
 * หน้าที่: คอมโพเนนต์หน้านี้เรนเดอร์หน้าตั้งค่าระบบและประกอบส่วนย่อยที่เกี่ยวข้อง
 */
export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Merchant-level AI, channel, and workspace settings scaffold."
        actions={<Button variant="secondary">Save Placeholder</Button>}
      />

      <Card title="Workspace Settings">
        <div className="content-stack">
          <div>
            <strong>Default AI Mode</strong>
            <p className="helper-text">Mock AI response pipeline enabled</p>
          </div>
          <div>
            <strong>LINE Channel Status</strong>
            <p className="helper-text">Not connected in Phase 2 foundation</p>
          </div>
          <div>
            <strong>Prompt Version</strong>
            <p className="helper-text">Prompt version linkage scaffold only</p>
          </div>
        </div>
      </Card>
    </>
  );
}
