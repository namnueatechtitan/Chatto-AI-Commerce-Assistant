export type DashboardStatIcon =
  | "messages"
  | "customers"
  | "orders"
  | "revenue"
  | "conversion"
  | "issues";

export interface DashboardStat {
  label: string;
  value: string;
  comparison: string;
  trend: string;
  trendDirection: "up" | "down";
  icon: DashboardStatIcon;
  tone: "primary" | "success" | "warning" | "danger";
}

export interface MessageOverviewPoint {
  label: string;
  total: number;
  ai: number;
}

export interface ChannelDistributionItem {
  name: string;
  value: number;
  followers: string;
  color: string;
  dotClassName: string;
}

export interface ProgressMetric {
  label: string;
  value: number;
}

export interface PerformanceMetric {
  label: string;
  value: string;
  change: string;
  direction: "up" | "down";
}

export interface CustomerIssueMetric {
  label: string;
  value: string;
  tone: "default" | "danger" | "info" | "success";
}

export interface CustomerIssueCategory {
  label: string;
  count: number;
  colorClassName: string;
}

export interface TopProduct {
  rank: number;
  name: string;
  sold: string;
  price: string;
  accentClassName: string;
}

export interface RecentOrder {
  id: string;
  customer: string;
  amount: string;
  status: "paid" | "pending" | "cancelled";
}

export interface AssistantHighlight {
  title: string;
  description: string;
}

export interface AssistantWidget {
  title: string;
  value: string;
  meta: string;
  action: string;
  variant: "success" | "warning" | "outline";
}

export const dashboardOverview = {
  greeting: "สวัสดีครับ, Admin",
  storeSummary: "ภาพรวมการทำงานของร้าน GENTLEWOMAN SHOP",
  inventoryAlert: "สินค้าใกล้หมด 3 รายการ !",
  aiStatus: "Chatto AI กำลังทำงานอยู่",
  profileName: "Prayut ChanOcha",
  profileRole: "Admin",
  periodLabel: "7 วันที่ผ่านมา",
};

export const dashboardStats: DashboardStat[] = [
  {
    label: "ข้อความทั้งหมด",
    value: "25,680",
    comparison: "จากสัปดาห์ก่อน",
    trend: "+12.3%",
    trendDirection: "up",
    icon: "messages",
    tone: "primary",
  },
  {
    label: "ลูกค้าที่คุย",
    value: "8,240",
    comparison: "จากสัปดาห์ก่อน",
    trend: "+9.7%",
    trendDirection: "up",
    icon: "customers",
    tone: "success",
  },
  {
    label: "ออเดอร์ทั้งหมด",
    value: "1,250",
    comparison: "จากสัปดาห์ก่อน",
    trend: "+15.7%",
    trendDirection: "up",
    icon: "orders",
    tone: "warning",
  },
  {
    label: "รายได้รวม",
    value: "฿1,250,780",
    comparison: "จากสัปดาห์ก่อน",
    trend: "+18.2%",
    trendDirection: "up",
    icon: "revenue",
    tone: "success",
  },
  {
    label: "Conversion Rate",
    value: "4.82%",
    comparison: "จากสัปดาห์ก่อน",
    trend: "+1.2%",
    trendDirection: "up",
    icon: "conversion",
    tone: "primary",
  },
  {
    label: "แจ้งปัญหาลูกค้า",
    value: "7 รายการ",
    comparison: "รอดำเนินการ 3 รายการ",
    trend: "-6.4%",
    trendDirection: "down",
    icon: "issues",
    tone: "danger",
  },
];

export const messageOverviewData: MessageOverviewPoint[] = [
  { label: "24 พ.ค.", total: 1480, ai: 920 },
  { label: "25 พ.ค.", total: 1960, ai: 1180 },
  { label: "26 พ.ค.", total: 2320, ai: 1420 },
  { label: "27 พ.ค.", total: 2250, ai: 1390 },
  { label: "28 พ.ค.", total: 3010, ai: 1810 },
  { label: "29 พ.ค.", total: 3620, ai: 2410 },
  { label: "30 พ.ค.", total: 3410, ai: 2160 },
];

export const channelDistributionData: ChannelDistributionItem[] = [
  {
    name: "LINE OA",
    value: 20030,
    followers: "1.3k Followers",
    color: "#16A34A",
    dotClassName: "bg-emerald-500",
  },
  {
    name: "Facebook",
    value: 3852,
    followers: "720 Followers",
    color: "#2563EB",
    dotClassName: "bg-blue-600",
  },
  {
    name: "Instagram",
    value: 1284,
    followers: "218 Followers",
    color: "#EF4444",
    dotClassName: "bg-red-500",
  },
  {
    name: "Other",
    value: 514,
    followers: "35 Sources",
    color: "#CBD5E1",
    dotClassName: "bg-slate-300",
  },
];

export const aiKnowledgeMetrics: ProgressMetric[] = [
  { label: "Product data sync", value: 98 },
  { label: "FAQ coverage", value: 84 },
  { label: "Order", value: 72 },
  { label: "Policy docs", value: 72 },
];

export const aiPerformanceMetrics: PerformanceMetric[] = [
  {
    label: "AI Accuracy",
    value: "96.2%",
    change: "+4.5%",
    direction: "up",
  },
  {
    label: "AI Containment Rate",
    value: "96.2%",
    change: "+3.2%",
    direction: "up",
  },
  {
    label: "Avg. Response Time",
    value: "1m 24s",
    change: "-9.2%",
    direction: "down",
  },
  {
    label: "Human Handover Rate",
    value: "3.8%",
    change: "-2.1%",
    direction: "down",
  },
];

export const customerIssueMetrics: CustomerIssueMetric[] = [
  { label: "ปัญหาทั้งหมด (สัปดาห์นี้)", value: "7", tone: "default" },
  { label: "รอดำเนินการ", value: "3", tone: "danger" },
  { label: "กำลังดำเนินการ", value: "2", tone: "info" },
  { label: "แก้ไขแล้ว", value: "2", tone: "success" },
];

export const customerIssueCategories: CustomerIssueCategory[] = [
  {
    label: "สินค้าชำรุด/ผิดรุ่น",
    count: 3,
    colorClassName: "bg-red-400",
  },
  {
    label: "จัดส่งล่าช้า",
    count: 2,
    colorClassName: "bg-amber-400",
  },
  {
    label: "ต้องการคืน/เปลี่ยนสินค้า",
    count: 2,
    colorClassName: "bg-emerald-500",
  },
];

export const topProducts: TopProduct[] = [
  {
    rank: 1,
    name: "SOLEA BAG : Pastel Blue",
    sold: "ขายแล้ว 320 ชิ้น",
    price: "8890",
    accentClassName: "from-sky-100 to-slate-100",
  },
  {
    rank: 2,
    name: "The Seaside Scroll Shoulder Tote Bag",
    sold: "ขายแล้ว 320 ชิ้น",
    price: "8690",
    accentClassName: "from-stone-100 to-orange-50",
  },
  {
    rank: 3,
    name: "The Golden Shore Shoulder Bag",
    sold: "ขายแล้ว 320 ชิ้น",
    price: "7409",
    accentClassName: "from-yellow-100 to-amber-50",
  },
  {
    rank: 4,
    name: "Fawn Bloom Fur Shoulder Bag",
    sold: "ขายแล้ว 320 ชิ้น",
    price: "6390",
    accentClassName: "from-rose-100 to-orange-100",
  },
];

export const recentOrders: RecentOrder[] = [
  {
    id: "#ORD-250530-0012",
    customer: "คุณนักริรา",
    amount: "฿1,290",
    status: "paid",
  },
  {
    id: "#ORD-250530-0011",
    customer: "คุณปวีณา",
    amount: "฿8,690",
    status: "cancelled",
  },
  {
    id: "#ORD-250530-0010",
    customer: "คุณศักดิ์ชัย",
    amount: "฿8,980",
    status: "pending",
  },
  {
    id: "#ORD-250530-0009",
    customer: "คุณอริสรา",
    amount: "฿1,290",
    status: "paid",
  },
  {
    id: "#ORD-250530-0008",
    customer: "คุณรนนพ",
    amount: "฿890",
    status: "cancelled",
  },
  {
    id: "#ORD-250530-0007",
    customer: "คุณอนุทิน",
    amount: "฿8,980",
    status: "pending",
  },
  {
    id: "#ORD-250530-0006",
    customer: "คุณลลิศา",
    amount: "฿590",
    status: "cancelled",
  },
  {
    id: "#ORD-250530-0005",
    customer: "คุณครูนก",
    amount: "฿28,980",
    status: "pending",
  },
];

export const assistantHighlights: AssistantHighlight[] = [
  {
    title: "AI ตอบข้อความได้ 84% ของแชทวันนี้",
    description: "ลดงานแอดมินหน้าร้านและช่วยให้ทีมโฟกัสกับเคสสำคัญมากขึ้น",
  },
  {
    title: "มี 3 เคสที่ควรติดตาม",
    description: "ลูกค้ารอข้อมูลเรื่องจัดส่งล่าช้าและต้องการเปลี่ยนสินค้าหลังรับของ",
  },
  {
    title: "ความรู้เรื่องสินค้าใหม่ยังไม่ครบ",
    description: "ควรอัปโหลดรายละเอียดคอลเลกชัน Summer Drop เพื่อเพิ่มความแม่นยำ",
  },
];

export const assistantWidgets: AssistantWidget[] = [
  {
    title: "AI Model Status",
    value: "GPT-4o (Latest)",
    meta: "พร้อมใช้งาน",
    action: "ทดสอบ AI",
    variant: "success",
  },
  {
    title: "Knowledge Base",
    value: "528 รายการ",
    meta: "จำนวนความรู้ทั้งหมด",
    action: "จัดการความรู้",
    variant: "outline",
  },
  {
    title: "FAQ",
    value: "128 รายการ",
    meta: "จำนวน FAQ ทั้งหมด",
    action: "จัดการ FAQ",
    variant: "outline",
  },
  {
    title: "LINE Official Account",
    value: "@Gentlewomanshop",
    meta: "เชื่อมต่อแล้ว",
    action: "จัดการการเชื่อมต่อ",
    variant: "success",
  },
  {
    title: "พื้นที่ใช้งาน",
    value: "ใช้ไป 68% (6.8 / 10 GB)",
    meta: "อัปโหลดข้อมูลและเอกสารความรู้ได้ต่อเนื่อง",
    action: "จัดการพื้นที่",
    variant: "warning",
  },
];

export const footerBenefits = [
  "ตอบเร็ว 24/7",
  "ลดภาระแอดมิน",
  "เพิ่มยอดขาย",
  "AI อัจฉริยะ เรียนรู้ธุรกิจคุณ",
];
