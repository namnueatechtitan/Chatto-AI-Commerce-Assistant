const assert = require("node:assert/strict");
const test = require("node:test");
const { renderCustomerRow, renderCustomerAnswer } = require("../dist/modules/qa/customer-renderer");
const { bindClaims, renderCatalogRow } = require("../dist/modules/qa/grounding");

const productId = "22222222-2222-4222-8222-222222222222";
function source(row, id = "sql:0") {
  return { id, type: "product", title: String(row.name || "Product"), text: renderCatalogRow(row) };
}
function answer(rows, question, th = false) {
  const sources = rows.map((row, i) => source(row, `sql:${i}`));
  const claims = bindClaims(sources.map(s => ({ source_id: s.id, quote: s.text })), sources);
  return renderCustomerAnswer(claims, sources, rows, question, th);
}

test("customer wording preserves price/currency and quantity associations without technical IDs", () => {
  const text = answer([{ product_id: productId, name: "Cotton Bag", sku: "BAG-RED-M", price: 390, currency: "THB", available_qty: 9 }], "What are the price and stock?");
  assert.match(text, /Cotton Bag/);
  assert.match(text, /price.{0,20}390\s*THB/iu);
  assert.match(text, /9\s*units\s*available/iu);
  assert.doesNotMatch(text, /product_id|available_qty|22222222|390\s*units|price(?: is)? 9(?:\D|$)/iu);
});
test("Thai templates preserve an explicit non-THB currency rather than substituting baht", () => {
  const text = renderCustomerRow({ name: "Cotton Bag", price: 12.5, currency: "USD" }, "ราคาเท่าไหร่", true);
  assert.match(text, /12\.5\s*USD/);
  assert.doesNotMatch(text, /บาท|THB/);
  const unknownCurrency = renderCustomerRow({ name: "Cotton Bag", price: 12.5, currency: null }, "What is the price?", false);
  assert.match(unknownCurrency, /12\.5/);
  assert.doesNotMatch(unknownCurrency, /THB|USD|บาท/);
});
test("zero facts remain known zero while null price and quantity remain unknown", () => {
  const known = renderCustomerRow({ name: "Cotton Bag", price: 0, currency: "THB", available_qty: 0 }, "price and stock", false);
  assert.match(known, /price.{0,20}0\s*THB/iu);
  assert.match(known, /0\s*units\s*available/iu);
  assert.doesNotMatch(known, /not recorded|unknown/iu);
  const unknown = renderCustomerRow({ name: "Cotton Bag", price: null, currency: "THB", available_qty: null }, "price and stock", false);
  assert.match(unknown, /price.{0,20}(?:not recorded|unknown)/iu);
  assert.match(unknown, /quantity.{0,20}(?:not recorded|unknown)/iu);
  assert.doesNotMatch(unknown, /null|undefined|\b0\b/iu);
});
test("a question about price and availability includes both requested live facts", () => {
  const text = renderCustomerRow({ name: "Cotton Bag", price: 390, currency: "THB", available_qty: 9 }, "What is its price and availability?", false);
  assert.match(text, /390\s*THB/);
  assert.match(text, /9\s*units\s*available/iu);
});
test("mixed price/material and stock/care questions retain the requested verified description", () => {
  const row = { name: "Cotton Bag", variant_name: "Natural cotton", price: 390, currency: "THB", available_qty: 9,
    description: "Made of cotton. Hand wash with cold water." };
  const english = renderCustomerRow(row, "What is it made of and how much does it cost?", false);
  assert.match(english, /390\s*THB/);
  assert.match(english, /Natural cotton/);
  assert.match(english, /Made of cotton\. Hand wash with cold water\./);
  const thai = renderCustomerRow(row, "เหลือกี่ชิ้น และดูแลซักอย่างไร", true);
  assert.match(thai, /9\s*ชิ้น/);
  assert.match(thai, /Made of cotton\. Hand wash with cold water\./);
});
test("a mixed brand/price question retains the verified brand field", () => {
  const text = renderCustomerRow({ name: "Cotton Bag", brand: "Example Brand", price: 390, currency: "THB" }, "Which brand is it and what is the price?", false);
  assert.match(text, /brand Example Brand/);
  assert.match(text, /390\s*THB/);
});
test("same-name variants retain customer-readable identifiers next to their different prices", () => {
  const text = answer([
    { product_id: productId, name: "Cotton Bag", sku: "BAG-RED-M", variant_name: "Red medium", color: "red", size: "M", price: 390, currency: "THB" },
    { product_id: productId, name: "Cotton Bag", sku: "BAG-BLUE-L", variant_name: "Blue large", color: "blue", size: "L", price: 490, currency: "THB" },
  ], "What are the variant prices?");
  const rows = text.split("\n");
  assert.equal(rows.length, 2);
  assert.match(rows[0], /(?:Red medium|BAG-RED-M|(?:red.*M|M.*red))/iu);
  assert.match(rows[0], /390\s*THB/);
  assert.match(rows[1], /(?:Blue large|BAG-BLUE-L|(?:blue.*L|L.*blue))/iu);
  assert.match(rows[1], /490\s*THB/);
  assert.doesNotMatch(text, /product_id|22222222/);
});
test("a row/source mismatch cannot replace a bound bag fact with unrelated cup values", () => {
  const verified = { name: "Cotton Bag", price: 390, currency: "THB" };
  const evidence = source(verified);
  const claims = bindClaims([{ source_id: evidence.id, quote: evidence.text }], [evidence]);
  const unrelated = { name: "Cup", price: 9, currency: "USD" };
  assert.throws(() => renderCustomerAnswer(claims, [evidence], [unrelated], "What is the price?", false), /UNSUPPORTED|MISMATCH|INVALID/);
});
test("unknown aggregate counts do not turn into the literal number null", () => {
  const zero = renderCustomerRow({ count_distinct_product_id: 0 }, "How many products are there?", false);
  const unknown = renderCustomerRow({ count_distinct_product_id: null }, "How many products are there?", false);
  assert.match(zero, /0\s*products/iu);
  assert.match(unknown, /not recorded|unknown|unavailable/iu);
  assert.doesNotMatch(unknown, /null|undefined|\b0\b/iu);
});
test("catalog and knowledge row counts are not relabelled as product counts", () => {
  const catalog = renderCustomerRow({ count_catalog_rows: 12 }, "How many variants?", false);
  const knowledge = renderCustomerRow({ count_knowledge_rows: 6 }, "How many FAQ entries?", false);
  const legacy = renderCustomerRow({ count: 6 }, "How many entries?", false);
  assert.match(catalog, /12 catalogue rows/);
  assert.match(knowledge, /6 knowledge entries/);
  assert.match(legacy, /Rows: 6/);
  for (const text of [catalog, knowledge, legacy]) assert.doesNotMatch(text, /\d+\s*products/iu);
});
test("aggregate price/quantity labels follow canonical operation and field with explicit currency scope", () => {
  const unknownCurrency = renderCustomerRow({ sum_price: 4780, min_price: 250, max_price: 1290, sum_available_qty: 40 }, "What are the totals?", false);
  assert.match(unknownCurrency, /Sum of recorded price values: 4780 \(currency not specified\)/);
  assert.match(unknownCurrency, /Minimum of recorded price values: 250 \(currency not specified\)/);
  assert.match(unknownCurrency, /Sum of recorded available quantity values: 40 units/);
  assert.doesNotMatch(unknownCurrency, /4780 units|total units|THB/);
  const grouped = renderCustomerRow({ currency: "USD", avg_price: 12.5 }, "Average price?", true);
  assert.match(grouped, /12\.5 USD/);
  assert.doesNotMatch(grouped, /บาท|THB|ไม่ได้ระบุสกุลเงิน/);
});
test("distinct aggregate and non-null counts retain their operation rather than product cardinality", () => {
  const text = renderCustomerRow({ count_price: 4, count_distinct_color: 3, sum_distinct_available_qty: 8 }, "Give the aggregate values", false);
  assert.match(text, /Count of recorded price values: 4/);
  assert.match(text, /Count of distinct colour values: 3/);
  assert.match(text, /Sum of distinct available quantity values: 8 units/);
  assert.doesNotMatch(text, /4 products|3 products|8 products/);
});
test("policy prose remains its bound exact quote even for a Thai customer", () => {
  const evidence = { id: "rag:0", type: "refund_policy", title: "Returns", text: "Returns within seven days. Sale items are excluded." };
  const quote = evidence.text;
  const claims = bindClaims([{ source_id: evidence.id, quote }], [evidence]);
  assert.equal(renderCustomerAnswer(claims, [evidence], [], "คืนสินค้าได้ไหม", true), quote);
});
