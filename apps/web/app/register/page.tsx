/**
 * หน้าที่ไฟล์: ไฟล์นี้เป็นหน้าสมัครใช้งานและทำหน้าที่ประกอบคอมโพเนนต์หลักที่ใช้แสดงผลในเส้นทางนี้
 */

import Link from "next/link";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";

/**
 * หน้าที่: คอมโพเนนต์หน้านี้เรนเดอร์หน้าสมัครใช้งานและประกอบส่วนย่อยที่เกี่ยวข้อง
 */
export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Card title="Merchant Registration">
          <div className="content-stack">
            <div>
              <h1>Create your Chatto merchant workspace</h1>
              <p className="helper-text">
                Phase 2 registration scaffold for merchant onboarding.
              </p>
            </div>

            <form className="form-stack">
              <Input
                label="Merchant Name"
                name="shopName"
                placeholder="Acme Store"
              />
              <Input
                label="Your Name"
                name="name"
                placeholder="Alice Merchant"
              />
              <Input
                label="Business Category"
                name="businessCategory"
                placeholder="Retail"
              />
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="merchant@example.com"
              />
              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="Choose a password"
              />
              <Button type="submit">Register</Button>
            </form>

            <p className="helper-text">
              Already registered? <Link href="/login">Go to login</Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
