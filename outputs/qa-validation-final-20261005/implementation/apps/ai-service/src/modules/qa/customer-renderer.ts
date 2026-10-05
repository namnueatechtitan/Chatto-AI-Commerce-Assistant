import { renderCatalogRow, type Evidence, type BoundClaim } from "./grounding";
const labels:Record<string,[string,string]>={variant_name:["variant","รุ่น"],sku:["SKU","รหัสสินค้า"],color:["colour","สี"],size:["size","ขนาด"],category:["category","ประเภท"],brand:["brand","แบรนด์"]};
const colors:Record<string,string>={white:"ขาว",black:"ดำ",grey:"เทา",green:"เขียว",sand:"ทราย",navy:"น้ำเงินเข้ม"};
const aggregateFields: Record<string, [string, string]> = {
  price: ["price", "ราคา"], available_qty: ["available quantity", "จำนวนสินค้าพร้อมขาย"],
  product_id: ["product ID", "รหัสสินค้า"], variant_id: ["variant ID", "รหัสรุ่นสินค้า"],
  name: ["product name", "ชื่อสินค้า"], description: ["description", "รายละเอียด"],
  category: ["category", "ประเภท"], brand: ["brand", "แบรนด์"], sku: ["SKU", "รหัส SKU"],
  variant_name: ["variant name", "ชื่อรุ่นสินค้า"], color: ["colour", "สี"], size: ["size", "ขนาด"],
  currency: ["currency", "สกุลเงิน"], status: ["status", "สถานะ"],
  id: ["entry ID", "รหัสข้อมูล"], type: ["entry type", "ประเภทข้อมูล"],
  title: ["title", "ชื่อเรื่อง"], content: ["content", "เนื้อหา"],
};
/** Aggregate labels come from the compiler's operation/field keys, not model aliases. */
function renderAggregate(key: string, value: unknown, row: Record<string, unknown>, th: boolean): string | null {
  const knownCounts: Record<string, [string, string, string]> = {
    count_catalog_rows: ["catalogue rows", "แค็ตตาล็อก", "แถว"],
    count_knowledge_rows: ["knowledge entries", "ข้อมูลความรู้", "รายการ"],
    count_distinct_product_id: ["products", "สินค้า", "รายการ"],
    count_distinct_variant_id: ["variants", "รุ่นสินค้า", "รุ่น"],
  };
  const knownCount = knownCounts[key];
  if (knownCount) {
    if (value === null) return th ? `ยังไม่มีข้อมูลจำนวน${knownCount[1]}` : `The count of ${knownCount[0]} is not recorded`;
    return th ? `มี${knownCount[1]} ${value} ${knownCount[2]}` : `There are ${value} ${knownCount[0]}`;
  }
  // Legacy generic COUNT is a row count. It cannot establish a product count.
  if (key === "count") return value === null
    ? th ? "ยังไม่มีข้อมูลจำนวนแถว" : "The row count is not recorded"
    : th ? `จำนวนแถว: ${value}` : `Rows: ${value}`;
  const match = /^(count|sum|avg|min|max)_(distinct_)?([a-z_]+)$/u.exec(key);
  if (!match || !aggregateFields[match[3]]) return null;
  const [, operation, distinct, field] = match;
  const label = aggregateFields[field][th ? 1 : 0];
  if (operation === "count") {
    const countLabel = th ? `จำนวนค่า${label}${distinct ? "ที่แตกต่างกัน" : "ที่บันทึกไว้"}`
      : `Count of ${distinct ? "distinct" : "recorded"} ${label} values`;
    return `${countLabel}: ${value === null ? th ? "ไม่มีข้อมูล" : "not recorded" : value}`;
  }
  const operations: Record<string, [string, string]> = {
    sum: ["Sum", "ผลรวม"], avg: ["Average", "ค่าเฉลี่ย"], min: ["Minimum", "ค่าต่ำสุด"], max: ["Maximum", "ค่าสูงสุด"],
  };
  const resultLabel = th ? `${operations[operation][1]}${label}${distinct ? "จากค่าที่แตกต่างกัน" : "ที่บันทึกไว้"}`
    : `${operations[operation][0]} of ${distinct ? "distinct" : "recorded"} ${label} values`;
  if (value === null) return `${resultLabel}: ${th ? "ไม่มีข้อมูล" : "not recorded"}`;
  const currency = typeof row.currency === "string" && row.currency ? row.currency : null;
  const unit = field === "available_qty" ? th ? " ชิ้น" : " units"
    : field === "price" ? currency ? ` ${currency}` : th ? " (ไม่ได้ระบุสกุลเงิน)" : " (currency not specified)" : "";
  return `${resultLabel}: ${value}${unit}`;
}
/** Natural wording uses verified row values, never model-authored values. */
export function renderCustomerRow(row:Record<string,unknown>,question:string,th:boolean):string {
  const parts:string[]=[];
  const name=typeof row.name==="string"?row.name:typeof row.title==="string"?row.title:"";
  if(name)parts.push(name);
  const price=/(?:price|cost|how much|cheapest|expensive|ราคา|เท่าไร|เท่าไหร่|บาท)/iu.test(question);
  const stock=/(?:stock|available|availability|remaining|left|units|สต็อก|เหลือ|พร้อมขาย|กี่ตัว|กี่ชิ้น|จำนวน)/iu.test(question);
  const descriptionRequested=/(?:material|fabric|made\s+(?:out\s+)?of|care|wash|clean|specification|features?|describ|details?|tell\s+me\s+about|capacity|waterproof|วัสดุ|ผ้า|ทำจาก|ซัก|ดูแล|รายละเอียด|คุณสมบัติ|ความจุ|กันน้ำ)/iu.test(question);
  if (price||stock) for(const field of ["variant_name","sku","color","size"])if(row[field]!==null&&row[field]!==undefined)parts.push(`${labels[field][th?1:0]} ${th&&field==="color"?colors[String(row[field])]||row[field]:row[field]}`);
  if(Object.hasOwn(row,"price")&&(price||(!price&&!stock))) {
    const currency=typeof row.currency==="string"?row.currency:"";
    parts.push(row.price===null?th?"ยังไม่มีข้อมูลราคา":"The price is not recorded":th?`ราคา ${row.price}${currency==="THB"?" บาท":currency?` ${currency}`:""}`:`The price is ${row.price}${currency?` ${currency}`:""}`);
  }
  if(Object.hasOwn(row,"available_qty")&&(stock||(!price&&!stock))) parts.push(row.available_qty===null?th?"ยังไม่มีข้อมูลจำนวนสินค้าพร้อมขาย":"The available quantity is not recorded":th?`มีสินค้าพร้อมขาย ${row.available_qty} ชิ้น`:`There are ${row.available_qty} units available`);
  if(!price&&!stock) {
    for(const [field,text] of Object.entries(labels))if(row[field]!==null&&row[field]!==undefined)parts.push(`${text[th?1:0]} ${th&&field==="color"?colors[String(row[field])]||row[field]:row[field]}`);
  }
  if((descriptionRequested||(!price&&!stock))&&typeof row.description==="string"&&row.description)parts.push(row.description);
  if(price||stock) for(const [field,pattern] of [["brand",/(?:brand|แบรนด์|ยี่ห้อ)/iu],["category",/(?:category|type\s+of\s+product|ประเภท)/iu]] as const) {
    if(pattern.test(question)&&row[field]!==null&&row[field]!==undefined)parts.push(`${labels[field][th?1:0]} ${row[field]}`);
  }
  const base=new Set(["product_id","variant_id","id","name","title","content","type","price","currency","available_qty","status","description",...Object.keys(labels)]);
  for(const [key,value] of Object.entries(row))if(!base.has(key)) {
    parts.push(renderAggregate(key,value,row,th) ?? `${key.replace(/_/g," ")}: ${value===null?th?"ไม่มีข้อมูล":"not recorded":value}`);
  }
  if(typeof row.content==="string")parts.push(row.content);
  return parts.join(th?" — ":". ");
}
export function renderCustomerAnswer(claims:BoundClaim[],sources:Evidence[],rows:Record<string,unknown>[],question:string,th:boolean):string {
  const seen=new Set<string>(),parts:string[]=[];
  for(const claim of claims) {
    const source=sources.find(s=>s.id===claim.source_id);if(!source)throw new Error("UNSUPPORTED_CLAIM");
    const match=/^(?:sql|lookup):(\d+)$/u.exec(source.id);
    if(match&&rows[Number(match[1])]&&["product","sql"].includes(source.type)) {
      if(renderCatalogRow(rows[Number(match[1])])!==source.text)throw new Error("ROW_EVIDENCE_MISMATCH");
      if(seen.has(source.id))continue;seen.add(source.id);parts.push(renderCustomerRow(rows[Number(match[1])],question,th));
    }else parts.push(claim.quote);
  }
  return parts.join("\n");
}
