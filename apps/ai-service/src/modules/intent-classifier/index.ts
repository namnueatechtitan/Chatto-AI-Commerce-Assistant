export class IntentClassifier {
  classify(message: string) {
    const normalizedMessage = message.trim().toLowerCase();

    if (!normalizedMessage) {
      return {
        intent: "empty_message",
        confidence: 0.2,
      };
    }

    if (this.includesAny(normalizedMessage, ["price", "สินค้า", "ราคา", "มีไหม", "แนะนำ"])) {
      return {
        intent: "product_question",
        confidence: 0.82,
      };
    }

    if (this.includesAny(normalizedMessage, ["ship", "delivery", "ส่ง", "จัดส่ง"])) {
      return {
        intent: "shipping_question",
        confidence: 0.8,
      };
    }

    if (this.includesAny(normalizedMessage, ["pay", "payment", "จ่าย", "ชำระ"])) {
      return {
        intent: "payment_question",
        confidence: 0.8,
      };
    }

    if (this.includesAny(normalizedMessage, ["return", "refund", "คืน", "เคลม"])) {
      return {
        intent: "return_question",
        confidence: 0.8,
      };
    }

    if (
      this.includesAny(normalizedMessage, [
        "ภาษาไทย",
        "พูดไทย",
        "ตอบไทย",
        "คนไทย",
        "thai language",
      ])
    ) {
      return {
        intent: "language_preference",
        confidence: 0.9,
      };
    }

    if (this.includesAny(normalizedMessage, ["hello", "hi", "สวัสดี", "หวัดดี"])) {
      return {
        intent: "small_talk",
        confidence: 0.76,
      };
    }

    return {
      intent: "unknown",
      confidence: 0.65,
    };
  }

  private includesAny(message: string, terms: string[]): boolean {
    return terms.some((term) => message.includes(term));
  }
}
