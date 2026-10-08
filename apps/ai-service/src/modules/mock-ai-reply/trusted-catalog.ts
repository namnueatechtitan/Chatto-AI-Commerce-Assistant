import type { MerchantSettingsForAi, ProductExportResponse, RagRetrievedChunk } from "../../types/ai-contract.types";

export interface CatalogFallbackInput {
  intent?: string;
  merchantId?: string;
  customerMessage?: string;
  products?: ProductExportResponse;
  retrievedChunks?: RagRetrievedChunk[];
  merchantSettings?: MerchantSettingsForAi;
  policyDenied?: boolean;
}

const normalize = (text: string) => text.normalize("NFKC").toLowerCase().trim();
const words = (text: string) => Array.from(new Intl.Segmenter("th", { granularity: "word" }).segment(normalize(text)))
  .filter(part => part.isWordLike).map(part => part.segment);
const hasTerm = (query: string, term: string) => /[a-z0-9]/i.test(term)
  ? new RegExp("(^|[^a-z0-9])" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9])", "i").test(query)
  : query.includes(term);

/** Only structured, active catalog rows linked to same-tenant retrieved sources are evidence.
 * Free-text chunks, arbitrary scores and chunk count alone cannot authorize a factual answer. */
export function trustedCatalogFallback(input: CatalogFallbackInput): string | null {
  const { merchantId, products, merchantSettings } = input;
  if (!merchantId || !input.customerMessage || !products || products.merchant_id !== merchantId ||
    merchantSettings?.merchant_id !== merchantId || input.policyDenied) return null;
  const caps = merchantSettings.ai_profile?.capabilities;
  if (caps && (!caps.showPrices || !caps.checkStock || !caps.showPromotions)) return null;
  if (input.intent && !["unknown", "product_question", "product_search", "recommendation"].includes(input.intent)) return null;
  const query = normalize(input.customerMessage);
  // These facts have no structured support in the product export.
  if (/ship|deliver|payment|refund|return|discount|promo|material|fabric|logo|where|why|ส่ง|ชำระ|คืนสินค้า|ส่วนลด|โปรโมชั่น|ทำจาก|เนื้อผ้า|โลโก้|ที่ไหน|รับประกัน|ยกเว้น|ไม่เอา/iu.test(query)) return null;
  const browse = /what.*(?:sell|products)|catalog|ขายอะไร|สินค้า.*อะไร|มีสินค้าอะไร/iu.test(query);
  const sources = new Set((input.retrievedChunks ?? [])
    .filter(chunk => chunk.merchant_id === merchantId && chunk.source_type === "product")
    .map(chunk => chunk.source_id));
  const queryWords = words(query);
  const candidates = products.products.filter(product => product.merchant_id === merchantId &&
    product.status === "active" && sources.has(product.id) &&
    (browse || words(product.name).some(word => word.length >= 2 && queryWords.includes(word))));
  if (!candidates.length) return null;
  const thai = merchantSettings.ai_profile?.language === "th" || merchantSettings.default_language === "th";
  if (browse) return thai ? "รายการสินค้าในแคตตาล็อกที่ตรวจพบ: " + candidates.map(p => p.name).join(", ") +
    " (ยังไม่ใช่การยืนยันสต็อก)" : "Retrieved catalog listings: " + candidates.map(p => p.name).join(", ") +
    " (not an inventory confirmation).";
  if (candidates.length !== 1) return null; // Ambiguous product: ask rather than choose.
  const product = candidates[0];
  const variants = product.variants.filter(v => v.product_id === product.id && v.status === "active");
  if (!variants.length) return null;
  const colors = [...new Set(variants.flatMap(v => v.color ? [v.color] : []))];
  const sizes = [...new Set(variants.flatMap(v => v.size ? [v.size] : []))];
  const requestedColors = colors.filter(color => color.split("/").some(alias => hasTerm(query, normalize(alias))));
  const requestedSizes = sizes.filter(size => hasTerm(query, normalize(size)));
  if (!requestedColors.length && !requestedSizes.length && !/color|size|want|looking for|price|stock|สี|ไซส์|ขนาด|อยากได้|ต้องการ|ราคา|สต็อก/iu.test(query)) return null;
  if (/สี|colou?r/iu.test(query) && !requestedColors.length &&
    !/กี่สี|สีอะไร|สีไหน|colou?rs/iu.test(query)) return null;
  if (/ไซส์|ขนาด|size/iu.test(query) && !requestedSizes.length &&
    !/ไซส์อะไร|ไซส์ไหน|ขนาดอะไร|กี่ไซส์|sizes/iu.test(query)) return null;
  const selected = variants.filter(v => (!requestedColors.length || !!v.color && requestedColors.includes(v.color)) &&
    (!requestedSizes.length || !!v.size && requestedSizes.includes(v.size)));
  if (!selected.length) return thai ? "ไม่พบคู่สีและไซส์นี้ในแคตตาล็อกที่ตรวจพบ" :
    "No matching color-size combination was found in the retrieved catalog.";
  const details = requestedColors.length || requestedSizes.length
    ? [...new Set(selected.map(v => [v.color, v.size].filter(Boolean).join(" / ")))].join(", ")
    : (thai ? "สี: " : "Colors: ") + colors.join(", ") + (thai ? "; ไซส์: " : "; sizes: ") + sizes.join(", ");
  let answer = product.name + (thai ? " — รายการในแคตตาล็อก: " : " — catalog listing: ") + details;
  if (/price|cost|ราคา|กี่บาท/iu.test(query)) {
    const prices = [...new Set(selected.map(v => v.price))];
    answer += prices.length === 1 && prices[0] !== null && new Set(selected.map(v => v.currency)).size === 1
      ? (thai ? "; ราคาที่ระบุ: " : "; documented price: ") + prices[0] + " " + selected[0].currency
      : (thai ? "; ยังไม่มีราคาที่ระบุชัดเจน" : "; price is not specified unambiguously");
  }
  const stockKnown = selected.every(v => v.stock_known === true);
  answer += !stockKnown ? (thai ? "; ยังไม่มีข้อมูลสต็อกที่ยืนยันได้" : "; inventory is unknown")
    : selected.every(v => v.available_qty === 0) ? (thai ? "; จำนวนพร้อมขายที่ระบุเป็น 0" : "; documented available quantity is zero")
    : (thai ? "; โปรดตรวจสอบสต็อกกับร้านก่อนสั่งซื้อ" : "; check inventory with the store before ordering");
  return answer;
}
