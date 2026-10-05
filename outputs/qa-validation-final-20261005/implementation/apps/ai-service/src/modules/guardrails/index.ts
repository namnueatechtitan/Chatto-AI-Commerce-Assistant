import type { RagRetrievedChunk } from "../../types/ai-contract.types";

export interface GuardrailResult {
  allowed: boolean;
  severity: "low" | "medium" | "high";
  stage: "input" | "context" | "output";
  reasons: string[];
  requires_handover: boolean;
}

const injection = [
  /\b(ignore|disregard|override|forget)\b.{0,60}\b(instructions?|rules?|prompts?|polic(?:y|ies))\b/iu,
  /\b(reveal|show|print|repeat|expose)\b.{0,60}\b(system prompt|developer message|api.?key|service.?token|secrets?)\b/iu,
  /\b(you are now|act as)\b.{0,40}\b(system|developer|unrestricted|jailbreak)\b/iu,
  /(?:ลืม|ละเลย|ไม่ต้องทำตาม|ข้าม).{0,50}(?:คำสั่ง|กฎ|ข้อกำหนด|ระบบ)/u,
  /(?:เปิดเผย|แสดง|บอก|ขอ).{0,40}(?:system prompt|คำสั่งระบบ|คีย์ลับ|api.?key|service.?token)/iu,
  /<\/?(?:system|developer)>|\[INST\]|\[SYSTEM\]/iu,
];
const secretPatterns = [
  /\b(?:sk-[a-zA-Z0-9_-]{16,}|AIza[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,})\b/u,
  /\bBearer\s+[a-zA-Z0-9._~+\/-]{12,}/iu,
  /\b(?:password|api[_ -]?key|service[_ -]?token)\s*[:=]\s*\S+/iu,
];
const commerceRequest = [
  /\b(?:place|create|cancel|confirm|submit)\b.{0,45}\b(?:order|payment|subscription)\b/iu,
  /\b(?:charge|refund|transfer)\s+(?:me|my|this|the|money|\d)/iu,
  /\b(?:reserve|book|hold)\b.{0,40}\b(?:product|item|bag|stock|units?)\b/iu,
  /(?:สั่งซื้อ|สั่งของ|เปิดออเดอร์|สร้างออเดอร์|ยกเลิกออเดอร์|ยกเลิกคำสั่งซื้อ|ยืนยันออเดอร์|คืนเงินให้|โอนเงินให้|ตัดบัตร|จองสินค้า)/u,
];
const dataWriteRequest = [
  // Require an imperative/request form; policy questions about deletion and
  // inventory remain readable information requests.
  /(?:^|[.!?;]\s*|\b(?:please|can\s+you|could\s+you|would\s+you|will\s+you|i\s+(?:want|need)\s+you\s+to|help\s+me)\s+)(?:delete|remove|drop|truncate)\s+(?:(?:all|the|these|those|my|our|every|entire|existing|from)\s+){0,3}(?:products?|product_variants|catalog(?:ue)?|items?|inventory|stock|tables?|database)\b/iu,
  /(?:^|[.!?;]\s*|\b(?:please|can\s+you|could\s+you|would\s+you|will\s+you|i\s+(?:want|need)\s+you\s+to|help\s+me)\s+)(?:set|update|change|adjust|increase|decrease|reset|replenish|deduct|reduce|clear)\b.{0,50}\b(?:stock|inventory)\b/iu,
  /\b(?:write|generate|run|execute|issue)\b.{0,25}\b(?:sql|query|statement|command)\b.{0,35}\b(?:delete|drop|truncate|update|insert)\b/iu,
  /^\s*(?:DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE)|TRUNCATE(?:\s+TABLE)?|UPDATE|INSERT\s+INTO)\s+(?:products?|product_variants|inventory|stock|catalog(?:ue)?)\b/iu,
  /(?:^|[.!?;]\s*|(?:ช่วย|กรุณา|โปรด|ขอให้|ทำการ|(?:ฉัน|ผม|เรา)?(?:ต้องการ|อยาก)(?:ให้(?:คุณ)?|จะ)?))\s*(?:ลบ|ล้าง|เคลียร์|ลบออก)\s*(?:สินค้า|ข้อมูลสินค้า|ผลิตภัณฑ์|รายการสินค้า|แคตตาล็อก|แค็ตตาล็อก|สต็อก|ฐานข้อมูล|ตาราง)/u,
  /(?:^|[.!?;]\s*|(?:ช่วย|กรุณา|โปรด|ขอให้|ทำการ|(?:ฉัน|ผม|เรา)?(?:ต้องการ|อยาก)(?:ให้(?:คุณ)?|จะ)?))\s*(?:ปรับ|ตั้ง|อัปเดต|อัพเดต|เพิ่ม|ลด|แก้ไข|รีเซ็ต|ล้าง)\s*(?:จำนวน)?(?:สต็อก|สินค้าคงเหลือ)/u,
  /(?:เขียน|สร้าง|รัน|เรียกใช้|ดำเนินการ|ประมวลผล).{0,25}(?:SQL|คำสั่ง|คิวรี|query).{0,35}(?:DELETE|DROP|TRUNCATE|UPDATE|INSERT|ลบสินค้า|ลบข้อมูล|ปรับสต็อก)/iu,
];
const humanRequest = /\b(?:speak|talk|connect|contact|transfer)\b.{0,40}\b(?:human|agent|staff|operator)\b|(?:ขอคุย|ติดต่อ|ขอพบ|เรียก).{0,20}(?:คนจริง|เจ้าหน้าที่|แอดมิน|พนักงาน)/iu;
const commerceClaim = [
  /\b(?:I|we)(?:'ve| have)?\s+(?:successfully\s+)?(?:placed|created|cancelled|canceled|confirmed|charged|refunded|reserved|transferred)\b/iu,
  /\b(?:order|payment|refund|reservation)\b.{0,40}\b(?:completed|confirmed|processed|successful)\b/iu,
  /(?:สั่งซื้อ|สร้างออเดอร์|ยกเลิกออเดอร์|ยืนยันออเดอร์|คืนเงิน|โอนเงิน|จองสินค้า|ตัดบัตร|ปรับสต็อก).{0,35}(?:สำเร็จ|เรียบร้อย|แล้ว)/u,
];

function normalize(text: string): string {
  // NFKC folds full-width ASCII but decomposes Thai SARA AM (ำ) into ํ + า.
  // Restore that sequence after removing invisible separators, so both Thai
  // spellings match the same security rules without losing ASCII normalization.
  return text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/\u0E4D\u0E32/gu, "\u0E33").replace(/\s+/gu, " ");
}

function containsSecret(text: string): boolean {
  if (secretPatterns.some(pattern => pattern.test(text))) return true;
  return ["AI_SERVICE_TOKEN", "INTERNAL_SERVICE_TOKEN", "GEMINI_API_KEY", "OPENAI_API_KEY", "JWT_SECRET"]
    .some(name => {
      const value = process.env[name]?.trim();
      return Boolean(value && value.length >= 8 && text.includes(value));
    });
}

function result(stage: GuardrailResult["stage"], reasons: string[], human = false): GuardrailResult {
  return {
    allowed: reasons.length === 0,
    severity: reasons.length ? "high" : human ? "medium" : "low",
    stage, reasons: human ? [...reasons, "CUSTOMER_REQUESTED_HUMAN"] : reasons,
    requires_handover: human || reasons.length > 0,
  };
}

export class GuardrailService {
  evaluate(message: string): GuardrailResult {
    const text = normalize(message);
    const reasons: string[] = [];
    if (!text.trim()) reasons.push("EMPTY_INPUT");
    if (injection.some(pattern => pattern.test(text))) reasons.push("PROMPT_INJECTION");
    if (containsSecret(text)) reasons.push("SENSITIVE_CREDENTIAL");
    if (commerceRequest.some(pattern => pattern.test(text)) || dataWriteRequest.some(pattern => pattern.test(text))) reasons.push("COMMERCE_ACTION_OUT_OF_SCOPE");
    return result("input", reasons, humanRequest.test(text));
  }

  evaluateContext(text: string): GuardrailResult {
    const normalized = normalize(text);
    const reasons: string[] = [];
    if (injection.some(pattern => pattern.test(normalized))) reasons.push("UNTRUSTED_CONTEXT_INSTRUCTION");
    if (containsSecret(normalized)) reasons.push("SENSITIVE_CONTEXT");
    return result("context", reasons);
  }

  evaluateOutput(input: {
    reply: string;
    chunks: RagRetrievedChunk[];
    requires_evidence: boolean;
    system_prompt?: string;
  }): GuardrailResult {
    const text = normalize(input.reply);
    const reasons: string[] = [];
    if (!text.trim()) reasons.push("EMPTY_REPLY");
    if (text.length > 4500) reasons.push("REPLY_TOO_LONG");
    if (containsSecret(text)) reasons.push("SENSITIVE_OUTPUT");
    if (injection.some(pattern => pattern.test(text))) reasons.push("UNSAFE_OUTPUT_INSTRUCTION");
    if (commerceClaim.some(pattern => pattern.test(text))) reasons.push("UNSUPPORTED_ACTION_CLAIM");
    const prompt = input.system_prompt ? normalize(input.system_prompt) : "";
    if (prompt.length >= 40 && text.includes(prompt)) reasons.push("SYSTEM_PROMPT_LEAK");
    if (input.requires_evidence) {
      if (!input.chunks.length) reasons.push("UNGROUNDED_REPLY");
      // Conservative numeric check; not a semantic fact-checking proof.
      const sourceNumbers = new Set(numbers(input.chunks.map(c => c.chunk_text).join(" ")));
      if (numbers(text).some(number => !sourceNumbers.has(number))) reasons.push("UNSUPPORTED_NUMBER");
    }
    return result("output", reasons);
  }
}

function numbers(text: string): string[] {
  const normalized = text.replace(/[๐-๙]/gu, digit => String(digit.charCodeAt(0) - 0x0E50));
  return (normalized.match(/\d+(?:,\d{3})*(?:\.\d+)?/gu) ?? [])
    .map(value => String(Number(value.replace(/,/g, ""))));
}

export function safeHandoverReply(language: string, blocked = false): string {
  if (language === "th") return blocked
    ? "ขออภัยครับ ผมไม่สามารถดำเนินการตามคำขอนี้ได้ จำเป็นต้องให้เจ้าหน้าที่ตรวจสอบเพิ่มเติมครับ"
    : "ขออภัยครับ ข้อมูลที่มีอยู่ยังไม่เพียงพอที่จะตอบได้อย่างมั่นใจ จำเป็นต้องให้เจ้าหน้าที่ตรวจสอบเพิ่มเติมครับ";
  return blocked
    ? "I cannot complete this request. A staff member needs to review it."
    : "I do not have enough reliable information to answer. A staff member needs to review this.";
}
