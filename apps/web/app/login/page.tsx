import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";


const errors: Record<string, string> = {
  google_not_configured: "ยังไม่ได้ตั้งค่า Google OAuth กรุณากรอกค่าใน .env แล้วรีสตาร์ต API",
  google_cancelled: "คุณยกเลิกการเข้าสู่ระบบด้วย Google สามารถลองใหม่ได้",
  google_failed: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาเริ่มใหม่อีกครั้ง",
  account_exists: "อีเมลนี้มีบัญชีเดิมที่ยังไม่ได้เชื่อมกับ Google กรุณาติดต่อผู้ดูแลระบบ",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">เข้าสู่ระบบ Chatto</h1>
        <p className="mt-2 text-sm text-slate-600">จัดการผู้ช่วย AI ของคุณ</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errors[error] || errors.google_failed}</p>}
        <a href="/api/auth/google" className="mt-6 flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-800 hover:bg-slate-50">
          ดำเนินการต่อด้วย Google
        </a>
        <p className="mt-4 text-center text-sm text-slate-500">หากยังไม่มีบัญชี ระบบจะสร้างบัญชีให้โดยอัตโนมัติ</p>
      </section>
    </main>
  );
}
