const path = require("node:path");
const { createRequire } = require("node:module");

const MERCHANT_A = "11111111-1111-4111-8111-111111111111";
const MERCHANT_B = "22222222-2222-4222-8222-222222222222";
const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const products = [
  [1, "Cloud Oversized Shirt", "shirt", "White cotton oversized shirt. Cold gentle wash; do not bleach. เสื้อ Cloud สีขาว ผ้าฝ้าย 100% ทรงโอเวอร์ไซซ์ ซักน้ำเย็นแบบอ่อนโยน ห้ามฟอกขาว. Waterproof certification and fabric test results are not provided.", "white", "M", 490, 10, 2],
  [2, "Ink Basic Tee", "shirt", "Black regular-fit T-shirt, 100% cotton. เสื้อยืด Ink สีดำ ผ้าฝ้าย 100% ทรงปกติ. No guarantee about color after 500 washes is provided.", "black", "M", 390, 7, 1],
  [3, "Luna Hoodie", "hoodie", "Black relaxed hoodie, 100% cotton fleece, hood and front pocket. เสื้อฮู้ด Luna สีดำ ผ้าคอตตอนฟลีซ 100% ทรงหลวม มีฮู้ดและกระเป๋าหน้า.", "black", "M", 790, 5, 0],
  [4, "Nova Hoodie", "hoodie", "Grey regular hoodie, 80% cotton and 20% polyester. เสื้อฮู้ด Nova สีเทา ผ้าฝ้าย 80% โพลีเอสเตอร์ 20%.", "grey", "S", 690, 4, 1],
  [5, "Sand Canvas Tote", "bag", "Sand-colored cotton canvas tote, width 35 cm, height 40 cm. One open compartment; no zip. กระเป๋า Sand สีทราย ผ้าแคนวาสฝ้าย กว้าง 35 ซม. สูง 40 ซม. ไม่มีซิป. Weight capacity and waterproof rating are not specified.", "sand", "one size", 290, 12, 2],
  [6, "Moss Linen Shirt", "shirt", "Green regular shirt, 100% linen. เสื้อ Moss สีเขียว ผ้าลินิน 100% ทรงปกติ. Hand wash in cool water; dry in shade. ซักมือด้วยน้ำเย็นและตากในร่ม.", "green", "L", 590, 6, 0],
  [7, "Night Cotton Cap", "accessory", "Black cotton cap with adjustable strap for 54–60 cm head circumference. หมวก Night สีดำ ผ้าฝ้าย 100% สายปรับได้ รอบศีรษะ 54–60 ซม.", "black", "adjustable", 250, 0, 0],
  [8, "Rain Light Jacket", "jacket", "Navy lightweight nylon jacket. เสื้อแจ็กเก็ต Rain สีน้ำเงินเข้ม ผ้าไนลอน น้ำหนักเบา. No waterproof certification or laboratory rating is published.", "navy", "M", 1290, 3, 1],
];
const knowledge = [
  [1, "shipping_policy", "Delivery policy / การจัดส่ง", "Dispatch within 2 business days. Estimated delivery after dispatch: Bangkok 2–3 business days, other Thai provinces 3–5 business days. Thai delivery fee: 60 THB; free for product subtotal at least 1000 THB. Estimates are not guaranteed arrival dates. จัดส่งออกภายใน 2 วันทำการ กรุงเทพฯ หลังส่งประมาณ 2–3 วันทำการ ต่างจังหวัด 3–5 วันทำการ ค่าส่งในไทย 60 บาท ยอดสินค้าตั้งแต่ 1000 บาทส่งฟรี. International fees are not provided."],
  [2, "return_policy", "Return policy / คืนสินค้า", "Request a return within 7 days of receipt for unworn items with tags. For a manufacturing defect, send photos to staff in this chat. คืนสินค้าภายใน 7 วันหลังได้รับ ต้องไม่ผ่านการสวมและมีป้าย หากสินค้าเสียหายจากการผลิตให้ส่งรูปให้พนักงานในแชต. This document describes a policy; it does not process a return."],
  [3, "faq", "Showroom hours / เวลาเปิด", "Showroom opens Monday–Saturday 10:00–18:00 Bangkok time and is closed on Sunday. โชว์รูมเปิดจันทร์ถึงเสาร์ 10:00–18:00 น. เวลาไทย ปิดวันอาทิตย์. Holiday exceptions are not specified."],
  [4, "faq", "Fabric care / การดูแลผ้า", "Cloud and Ink: cold gentle wash; no bleach. Moss: hand wash in cool water and dry in shade. เสื้อ Cloud และ Ink ซักน้ำเย็นแบบอ่อนโยน ห้ามฟอกขาว ส่วน Moss ซักมือด้วยน้ำเย็นและตากในร่ม. No fabric durability test after 500 washes is provided."],
  [5, "faq", "Specifications and warranty / สเปก", "Only published product specifications are verified. Waterproof certificates, safe bag carrying capacity and exact delivery dates are unavailable. Staff can investigate missing specifications. ยืนยันได้เฉพาะสเปกที่ประกาศ ไม่มีข้อมูลใบรับรองกันน้ำ น้ำหนักบรรทุกกระเป๋าที่ปลอดภัย หรือวันถึงที่รับประกัน กรุณาสอบถามพนักงาน."],
  [6, "faq", "Human assistance / ติดต่อพนักงาน", "Human assistance is available in this chat during showroom hours; staff speak Thai and English. In-person fitting requires no appointment. ติดต่อพนักงานในแชตนี้ช่วงเวลาเปิดโชว์รูมได้ พนักงานตอบภาษาไทยและอังกฤษ ลองเสื้อที่โชว์รูมได้โดยไม่ต้องนัดหมาย. Telephone number and customer-private data are not published."],
];

function isolatedUrl() {
  const raw = process.env.QA_EXPERIMENT_DATABASE_URL;
  if (!raw) throw new Error("QA_EXPERIMENT_DATABASE_URL is required; the ordinary DATABASE_URL is never used");
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || decodeURIComponent(url.pathname) !== "/chatto_qa_experiment") {
    throw new Error("Seed writes are restricted to local database chatto_qa_experiment");
  }
  return raw;
}

function client() {
  const url = isolatedUrl();
  const apiRequire = createRequire(path.resolve(__dirname, "../../api/package.json"));
  const { PrismaClient } = apiRequire("@prisma/client");
  return new PrismaClient({ datasources: { db: { url } } });
}

async function withClient(action) {
  const prisma = client();
  try {
    const [database] = await prisma.$queryRawUnsafe("SELECT current_database() AS name");
    if (database.name !== "chatto_qa_experiment") throw new Error("Unexpected database; no seed write performed");
    return await action(prisma);
  } finally { await prisma.$disconnect(); }
}

async function seed() {
  return withClient(async prisma => {
    for (const [merchantId, shopName, slug] of [[MERCHANT_A, "Chatto QA Fixture Shop", "qa-fixture-primary"], [MERCHANT_B, "Other Merchant Fixture", "qa-fixture-other"]]) {
      await prisma.merchant.upsert({ where: { id: merchantId }, update: { shopName, slug, status: "ACTIVE" }, create: { id: merchantId, shopName, slug, status: "ACTIVE" } });
      const settings = { botName: "Chatto", language: "th", tone: "concise", handoverThreshold: "0.6500", memoryEnabled: false,
        storeRules: ["Fictional isolated QA experiment. Read-only information only."], forbiddenActions: ["order", "payment", "reservation", "inventory_update"] };
      await prisma.aiSetting.upsert({ where: { merchantId }, update: settings, create: { id: id("40000000", merchantId === MERCHANT_A ? 1 : 2), merchantId, ...settings } });
    }
    for (const [n, name, category, description, color, size, price, stockOnHand, stockReserved] of products) {
      const productId = id("10000000", n);
      const product = { merchantId: MERCHANT_A, name, category, description, brand: "Fixture Studio", status: "ACTIVE" };
      await prisma.product.upsert({ where: { id: productId }, update: product, create: { id: productId, ...product } });
      const variant = { merchantId: MERCHANT_A, productId, variantName: `${color} / ${size}`, sku: `QA-${n}`, color, size,
        price, currency: "THB", stockOnHand, stockReserved, lowStockThreshold: 2, status: "ACTIVE" };
      await prisma.productVariant.upsert({ where: { id: id("20000000", n) }, update: variant, create: { id: id("20000000", n), ...variant } });
    }
    for (const [n, type, title, content] of knowledge) {
      const document = { merchantId: MERCHANT_A, type, title, content, status: "ACTIVE" };
      await prisma.knowledgeBaseDocument.upsert({ where: { id: id("30000000", n) }, update: document, create: { id: id("30000000", n), ...document } });
    }
    const secretProduct = { merchantId: MERCHANT_B, name: "Secret Reserve Item", description: "Other merchant only. Never returned to the primary merchant.", category: "accessory", status: "ACTIVE" };
    await prisma.product.upsert({ where: { id: id("10000000", 101) }, update: secretProduct, create: { id: id("10000000", 101), ...secretProduct } });
    const secretVariant = { merchantId: MERCHANT_B, productId: id("10000000", 101), variantName: "private", sku: "QA-OTHER", color: "violet", size: "one size", price: 29, currency: "THB", stockOnHand: 999, stockReserved: 0, status: "ACTIVE" };
    await prisma.productVariant.upsert({ where: { id: id("20000000", 101) }, update: secretVariant, create: { id: id("20000000", 101), ...secretVariant } });
    return { database: "chatto_qa_experiment", merchants: [MERCHANT_A, MERCHANT_B], primary_products: 8, primary_knowledge: 6 };
  });
}

async function setState(state = "baseline") {
  const states = { baseline: { stockOnHand: 10, stockReserved: 2, price: 490 }, cloud_decreased: { stockOnHand: 4, stockReserved: 2, price: 490 }, cloud_price_updated: { stockOnHand: 10, stockReserved: 2, price: 590 } };
  if (!Object.hasOwn(states, state)) throw new Error("Unknown fixture state");
  return withClient(async prisma => {
    const value = states[state];
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: id("20000000", 1) } });
    if (variant.stockOnHand === value.stockOnHand && variant.stockReserved === value.stockReserved && Number(variant.price) === value.price) return;
    await prisma.$transaction([
      prisma.productVariant.update({ where: { id: variant.id }, data: value }),
      prisma.product.update({ where: { id: id("10000000", 1) }, data: { updatedAt: new Date() } }),
    ]);
  });
}

module.exports = { seed, setState, isolatedUrl, products, knowledge, MERCHANT_A, MERCHANT_B, id };
if (require.main === module) seed().then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error.message); process.exitCode = 1; });
