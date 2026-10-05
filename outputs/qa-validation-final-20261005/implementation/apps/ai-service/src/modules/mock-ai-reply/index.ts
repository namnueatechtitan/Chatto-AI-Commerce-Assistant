import type { AiResponse } from "../../types/ai-response";
import type {
  MerchantSettingsForAi,
  RagRetrievedChunk,
} from "../../types/ai-contract.types";

export const mockAiResponse: AiResponse = {
  intent: "general_question",
  confidence: 0.8,
  reply: "Mock AI response from Chatto AI Service",
  needs_handover: false,
  suggested_action: null,
};

export class MockAiReplyService {
  generateReply(input: {
    intent: string;
    confidence: number;
    language?: string;
    retrievedChunks?: RagRetrievedChunk[];
    merchantSettings?: MerchantSettingsForAi;
  }): AiResponse {
    const chunks = input.retrievedChunks ?? [];
    const botName = input.merchantSettings?.bot_name ?? "Chatto";
    const isThai = input.language === "th";

    if (input.intent === "small_talk" || input.intent === "language_preference") {
      return {
        ...mockAiResponse,
        intent: input.intent,
        confidence: input.confidence,
        reply: isThai
          ? `${botName}: สวัสดีครับ ยินดีให้บริการเป็นภาษาไทยครับ มีอะไรเกี่ยวกับร้านที่ให้ช่วยไหมครับ`
          : `${botName}: Hello! How can I help you with the store today?`,
        needs_handover: false,
        suggested_action: null,
      };
    }

    if (input.intent === "unknown") {
      return {
        ...mockAiResponse,
        intent: input.intent,
        confidence: input.confidence,
        reply: isThai
          ? `${botName}: ขออภัยครับ ผมยังไม่เข้าใจคำถาม กรุณาลองถามเกี่ยวกับสินค้า การจัดส่ง การชำระเงิน หรือนโยบายของร้านครับ`
          : `${botName}: Sorry, I did not understand that. Please ask about the store's products, shipping, payment information, or policies.`,
        needs_handover: false,
        suggested_action: null,
      };
    }

    const reply = this.buildContextReply(botName, chunks, isThai);

    return {
      ...mockAiResponse,
      intent: input.intent,
      confidence: input.confidence,
      reply: reply
        ? reply
        : isThai
          ? `${botName}: ขออภัยครับ ไม่พบข้อมูลของร้านที่ตรงกับคำถามนี้ หากต้องการสามารถให้เจ้าหน้าที่ตรวจสอบเพิ่มเติมได้ครับ`
          : `${botName}: I could not find matching store information, so a human can review this if needed.`,
      needs_handover: chunks.length === 0,
      suggested_action: chunks.length > 0 ? null : "human_review",
    };
  }

  private buildContextReply(
    botName: string,
    chunks: RagRetrievedChunk[],
    isThai: boolean,
  ): string | null {
    if (chunks.length === 0) {
      return null;
    }

    const productChunk = chunks.find((chunk) => chunk.source_type === "product");
    const policyChunks = chunks.filter(
      (chunk) =>
        chunk.source_type !== "product" &&
        ["shipping_policy", "payment_policy", "return_policy", "faq", "store_info"].includes(
          chunk.source_type,
        ),
    );
    const parts = [`${botName}:`];

    if (productChunk) {
      parts.push(this.summarizeProduct(productChunk.chunk_text, isThai));
    }

    for (const policyChunk of policyChunks.slice(0, 2)) {
      parts.push(this.summarizePolicy(policyChunk, isThai));
    }

    if (!productChunk && policyChunks.length === 0) {
      parts.push(this.cleanSentence(chunks[0].chunk_text));
    }

    return parts.join(" ");
  }

  private summarizeProduct(chunkText: string, isThai: boolean): string {
    const product = this.matchValue(chunkText, /Product:\s*([^.]*)\./i);
    const price = this.matchValue(chunkText, /Price:\s*([^.]*)\./i);
    const variant = this.matchValue(chunkText, /Variant:\s*([^.]*)\./i);
    const availableQty = this.matchValue(
      chunkText,
      /Available quantity:\s*([^.]*)\./i,
    );
    if (isThai) {
      const details = [
        product ? `สินค้า ${product}` : "สินค้านี้",
        price ? `ราคา ${price}` : undefined,
        variant ? `รุ่น ${variant}` : undefined,
        availableQty ? `มีพร้อมจำหน่าย ${availableQty} ชิ้น` : undefined,
      ].filter(Boolean);

      return `${details.join(" ")}ครับ`;
    }

    const details = [
      product ? `The ${product}` : "This product",
      price ? `is ${price}` : undefined,
      variant ? `for ${variant}` : undefined,
      availableQty ? `and has ${availableQty} available` : undefined,
    ].filter(Boolean);

    return `${details.join(" ")}.`;
  }

  private summarizePolicy(chunk: RagRetrievedChunk, isThai: boolean): string {
    const text = chunk.chunk_text.replace(`${chunk.title}:`, "").trim();

    if (isThai) {
      const label =
        chunk.source_type === "shipping_policy"
          ? "ข้อมูลการจัดส่งของร้าน"
          : chunk.source_type === "payment_policy"
            ? "ข้อมูลการชำระเงินของร้าน"
            : chunk.source_type === "return_policy"
              ? "ข้อมูลการคืนสินค้าของร้าน"
              : "ข้อมูลจากร้าน";

      return `${label}: ${this.cleanSentence(text)}`;
    }

    return `${chunk.title}: ${this.cleanSentence(text)}`;
  }

  private matchValue(text: string, pattern: RegExp): string | undefined {
    return text.match(pattern)?.[1]?.trim();
  }

  private cleanSentence(text: string): string {
    const normalized = text.replace(/\s+/g, " ").trim();

    if (!normalized) {
      return "";
    }

    return normalized.endsWith(".") ? normalized : `${normalized}.`;
  }
}
