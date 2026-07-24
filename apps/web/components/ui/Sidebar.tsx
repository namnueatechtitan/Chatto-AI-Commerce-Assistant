"use client";

/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ UI แบบใช้ซ้ำชื่อ Sidebar
 */


import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/faq", label: "FAQ / Knowledge" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/handover", label: "Handover" },
  { href: "/dashboard/settings", label: "Settings" },
];

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ sidebar ของส่วน นี้
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-title">Chatto</span>
        <span className="sidebar-brand-subtitle">
          Merchant AI Commerce Assistant
        </span>
      </div>

      <nav className="sidebar-nav" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive ? " sidebar-link-active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
