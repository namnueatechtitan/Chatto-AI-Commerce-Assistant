/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บข้อมูลคงที่ทั้งหมดที่ใช้ประกอบหน้า landing page ของเว็บ
 */

export interface NavItem {
  label: string;
  href: string;
}

export interface MetricItem {
  value: string;
  label: string;
  icon: "message" | "zap" | "trending" | "clock";
}

export interface FeatureItem {
  title: string;
  description: string;
  imageUrl: string;
}

export interface StepItem {
  title: string;
  description: string;
  icon: "link" | "package" | "bot" | "layout";
}

export interface PricingPlan {
  name: string;
  subtitle: string;
  price: string;
  featured?: boolean;
  cta: string;
  features: string[];
}

export interface Testimonial {
  quote: string;
  name: string;
  business: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FooterLinkGroup {
  title: string;
  links: string[];
}

export const homepageAssets = {
  logoMascot:
    "https://www.figma.com/api/mcp/asset/373656e0-e35e-4ef5-aa0e-36746b5a95b7",
  heroMascot:
    "https://www.figma.com/api/mcp/asset/b8458e1c-5819-4f44-b0d8-41cd377a2424",
  lineLogo:
    "https://www.figma.com/api/mcp/asset/ed7a4ac9-28fb-46d0-9725-9534260e4e20",
  featureAssistant:
    "https://www.figma.com/api/mcp/asset/6ce44ef6-8110-46a3-9a8a-51da88ea9617",
  featureLine:
    "https://www.figma.com/api/mcp/asset/f489c15c-3ae3-45c2-8802-461ff057f9ec",
  featureProduct:
    "https://www.figma.com/api/mcp/asset/6a25627e-8340-40fd-9513-bf3abc537e45",
  featureHandover:
    "https://www.figma.com/api/mcp/asset/e8fec7e8-f11b-4917-8003-7f6fb2bc79bb",
  featureContext:
    "https://www.figma.com/api/mcp/asset/34d2ccad-1950-49dc-a67a-16b39a157297",
  ctaMascot:
    "https://www.figma.com/api/mcp/asset/8d3699e1-26ee-4f7b-8f16-08873f82655e",
};

export const homepageNavItems: NavItem[] = [
  { label: "หน้าแรก", href: "#home" },
  { label: "ฟีเจอร์", href: "#features" },
  { label: "วิธีการใช้งาน", href: "#how-it-works" },
  { label: "ราคา", href: "#pricing" },
  { label: "ติดต่อเรา", href: "#contact" },
];

export const heroBullets = [
  "ตอบแชทไว ไม่พลาดทุกโอกาสการขาย",
  "AI เรียนรู้ร้านคุณ ตอบเหมือนแอดมินจริง",
  "เพิ่มยอดขายอัตโนมัติ ด้วย AI อัจฉริยะ",
];

export const homepageMetrics: MetricItem[] = [
  {
    value: "0 M +",
    label: "ข้อความที่ตอบกลับอัตโนมัติ",
    icon: "message",
  },
  {
    value: "-99%",
    label: "ตอบกลับไวขึ้น",
    icon: "zap",
  },
  {
    value: "0%",
    label: "ยอดขายเพิ่มขึ้น",
    icon: "trending",
  },
  {
    value: "24/7",
    label: "ไม่พลาดทุกโอกาสในการขาย",
    icon: "clock",
  },
];

export const homepageFeatures: FeatureItem[] = [
  {
    title: "AI Chat Assistant",
    description:
      "ระบบ AI ตอบข้อความลูกค้าอัตโนมัติแบบ Real-Time ผ่าน LINE OA ได้อย่างเป็นธรรมชาติ ตลอด 24 ชั่วโมง",
    imageUrl: homepageAssets.featureAssistant,
  },
  {
    title: "LINE OA Integration",
    description:
      "เชื่อมต่อ LINE Official Account เข้ากับ Chatto เพื่อให้ร้านค้าสามารถใช้งาน AI ผ่าน LINE ได้ทันที",
    imageUrl: homepageAssets.featureLine,
  },
  {
    title: "Product Recommendation",
    description:
      "AI สามารถแนะนำสินค้า โปรโมชั่น หรือสินค้าที่เหมาะสมกับลูกค้า ตามบริบทของบทสนทนา",
    imageUrl: homepageAssets.featureProduct,
  },
  {
    title: "Human Handover System",
    description:
      "ระบบสามารถส่งต่อบทสนทนาให้แอดมินเข้ามาดูแลต่อได้ทันที เมื่อ AI ไม่สามารถจัดการบางสถานการณ์ได้",
    imageUrl: homepageAssets.featureHandover,
  },
  {
    title: "Smart Context Understanding",
    description:
      "AI สามารถเข้าใจบริบท วิเคราะห์บทสนทนา และตอบกลับได้อย่างแม่นยำใกล้เคียงทีมงานจริง",
    imageUrl: homepageAssets.featureContext,
  },
];

export const showcaseBenefits = [
  "ดึงข้อมูลธุรกิจและตอบแชทได้แบบ Real-Time",
  "AI เรียนรู้ร้านคุณ ตอบได้เหมือนแอดมินมืออาชีพ",
  "จัดการบทสนทนา ลูกค้า และคำสั่งซื้อได้ในที่เดียว",
];

export const howItWorksSteps: StepItem[] = [
  {
    title: "เชื่อมต่อกับ LINE OA",
    description: "เชื่อมบัญชี Line เข้ากับ Chatto",
    icon: "link",
  },
  {
    title: "เพิ่มข้อมูลร้านค้า",
    description: "Upload สินค้า FAQ และข้อมูลร้าน",
    icon: "package",
  },
  {
    title: "เปิดใช้งาน AI",
    description: "Chatto เริ่มตอบลูกค้า",
    icon: "bot",
  },
  {
    title: "ติดตาม Dashboard",
    description: "ดูผลลัพธ์และปรับแต่ง Dashboard",
    icon: "layout",
  },
];

export const pricingPlans: PricingPlan[] = [
  {
    name: "Starter",
    subtitle: "เริ่มต้นใช้งานฟรี",
    price: "฿0 / เดือน",
    cta: "เริ่มต้นใช้งานฟรี",
    features: [
      "Dashboard พื้นฐาน",
      "Merchant Owner 1 คน",
      "เชื่อมต่อ LINE OA 1 บัญชี",
      "AI Chat Assistant",
      "Conversation History 30 วัน",
      "Product Knowledge 50 รายการ",
      "AI Messages 1000 ข้อความ / เดือน",
    ],
  },
  {
    name: "Plus",
    subtitle: "เติบโตไปพร้อมทีม AI",
    price: "฿990 / เดือน",
    cta: "เริ่มต้นใช้งานฟรี",
    features: [
      "ทดลองใช้ฟรี Starter",
      "Merchant Owner 1 คน",
      "Support Agent 1 คน",
      "Human Handover",
      "Customer Memory",
      "Product Knowledge 500 รายการ",
      "AI Messages 10000 ข้อความ / เดือน",
    ],
  },
  {
    name: "Pro",
    subtitle: "ขายครบทุกช่องทางด้วย AI",
    price: "฿2,490 / เดือน",
    cta: "เริ่มต้นใช้งานฟรี",
    features: [
      "Merchant Owner 1 คน",
      "Merchant Admin 2 คน",
      "Support Agent 3 คน",
      "Advanced Analytics",
      "Customer Memory Advanced",
      "Product Knowledge ไม่จำกัด",
      "AI Messages 50000 ข้อความ / เดือน",
    ],
  },
  {
    name: "Pro Max",
    subtitle: "ยกระดับธุรกิจด้วย AI เต็มรูปแบบ",
    price: "฿9,990 / เดือน",
    featured: true,
    cta: "เริ่มต้นใช้งานฟรี",
    features: [
      "Merchant Owner 1 คน",
      "Merchant Admin 2 คน",
      "Support Agent 3 คน",
      "Advanced Analytics",
      "Customer Memory Advanced",
      "Product Knowledge ไม่จำกัด",
      "AI Messages 50000 ข้อความ / เดือน",
    ],
  },
];

export const testimonials: Testimonial[] = [
  {
    quote: "ไม่ต้องเฝ้าแชททั้งวันอีกแล้ว มีเวลาทำอย่างอื่นเยอะมาก",
    name: "คุณใบตอง",
    business: "ร้าน Kanokpat",
  },
  {
    quote: "ลูกค้าตอบกลับเร็วขึ้น และทีมไม่ต้องตอบคำถามเดิมซ้ำ ๆ ตลอดทั้งวัน",
    name: "คุณบีม",
    business: "ร้านแฟชั่นออนไลน์",
  },
  {
    quote: "ช่วยให้การแนะนำสินค้าดูเป็นมืออาชีพมากขึ้น และปิดการขายได้ง่ายกว่าเดิม",
    name: "คุณแอน",
    business: "ร้านสุขภาพและความงาม",
  },
  {
    quote: "พอมีระบบ handover ทีมทำงานต่อได้เลย ไม่ต้องไล่อ่านแชทย้อนหลังทั้งหมด",
    name: "คุณบอส",
    business: "ร้านอุปกรณ์ไลฟ์สไตล์",
  },
];

export const faqs: FaqItem[] = [
  {
    question: "Chatto คืออะไร",
    answer:
      "Chatto คือ AI Commerce Assistant ที่ช่วยตอบแชทลูกค้าอัตโนมัติผ่าน LINE OA พร้อมเชื่อมข้อมูลสินค้า FAQ และบริบทธุรกิจของร้านคุณ",
  },
  {
    question: "Chatto แตกต่างจาก Chatbot ทั่วไปอย่างไร",
    answer:
      "Chatto เน้นการเข้าใจบริบทของร้านค้า ใช้ข้อมูลจริงของธุรกิจ และมี Human Handover เพื่อให้ทีมงานเข้ามารับช่วงต่อได้ทันทีเมื่อจำเป็น",
  },
  {
    question: "หาก AI ตอบไม่ได้จะทำอย่างไร",
    answer:
      "ระบบจะส่งต่อบทสนทนาให้ทีมแอดมิน หรือแจ้งเตือนให้มนุษย์เข้ามาดูแลแทนได้ พร้อมเก็บ context ให้ต่อบทสนทนาได้อย่างลื่นไหล",
  },
];

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Product",
    links: ["Features", "Dashboard", "LINE OA Integration", "Pricing", "Roadmap"],
  },
  {
    title: "Resources",
    links: ["Documentation", "FAQ", "Blog", "Help Center", "API Docs"],
  },
  {
    title: "Company",
    links: ["About us", "Contact", "Careers", "Partners", "Privacy Policy"],
  },
];
