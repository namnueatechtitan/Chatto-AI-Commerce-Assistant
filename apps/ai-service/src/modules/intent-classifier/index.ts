export class IntentClassifier {
  classify(message: string) {
    const normalizedMessage = message.trim().toLowerCase();

    if (!normalizedMessage) {
      return {
        intent: "empty_message",
        confidence: 0.2,
      };
    }

    if (
      /\b(product|products|price|cost|variant|variants|item|items|catalog|recommend|available)\b|\bhow much\b/u.test(
        normalizedMessage,
      ) ||
      this.includesAny(normalizedMessage, ["สินค้า", "ราคา", "มีไหม", "แนะนำ"])
    ) {
      return {
        intent: "product_question",
        confidence: 0.82,
      };
    }

    if (
      /\b(ship|shipping|delivery|deliver)\b/u.test(normalizedMessage) ||
      this.includesAny(normalizedMessage, ["ส่ง", "จัดส่ง"])
    ) {
      return {
        intent: "shipping_question",
        confidence: 0.8,
      };
    }

    if (
      /\b(pay|payment|payments)\b/u.test(normalizedMessage) ||
      this.includesAny(normalizedMessage, ["จ่าย", "ชำระ"])
    ) {
      return {
        intent: "payment_question",
        confidence: 0.8,
      };
    }

    if (
      /\b(return|returns|refund|refunds)\b/u.test(normalizedMessage) ||
      this.includesAny(normalizedMessage, ["คืน", "เคลม"])
    ) {
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

    if (
      /^(hello|hi|hey|good morning|good afternoon|good evening)[\s!,.?]*$/u.test(
        normalizedMessage,
      ) ||
      this.includesAny(normalizedMessage, ["สวัสดี", "หวัดดี"])
    ) {
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
