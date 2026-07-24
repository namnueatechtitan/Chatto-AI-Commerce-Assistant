/**
 * หน้าที่ไฟล์: ไฟล์นี้เป็นหน้าเข้าสู่ระบบและทำหน้าที่ประกอบคอมโพเนนต์หลักที่ใช้แสดงผลในเส้นทางนี้
 */

import Link from "next/link";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";

/**
 * หน้าที่: คอมโพเนนต์หน้านี้เรนเดอร์หน้าเข้าสู่ระบบและประกอบส่วนย่อยที่เกี่ยวข้อง
 */
export default function LoginPage() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Card title="Merchant Login">
          <div className="content-stack">
            <div>
              <h1>Welcome back to Chatto</h1>
              <p className="helper-text">
                Phase 2 foundation login screen. Hook real auth during backend
                integration.
              </p>
            </div>

            <form className="form-stack">
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
                placeholder="Enter your password"
              />
              <Button type="submit">Login</Button>
            </form>

            <p className="helper-text">
              Need an account? <Link href="/register">Create a merchant account</Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
