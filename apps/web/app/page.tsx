import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
      <Link
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        href="/auth"
      >
        เริ่มต้นการใช้งาน
      </Link>
      <Link
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
        href="/dashboard"
      >
        Dashboard
      </Link>
    </main>
  );
}
