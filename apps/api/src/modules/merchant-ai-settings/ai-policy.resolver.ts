import type { MerchantAiSettings } from "./merchant-ai-settings.types";

export class AiPolicyResolver {
  resolve(settings: MerchantAiSettings, message: string) {
    const caps = settings.capabilities;
    const denied = (!caps.recommendProducts && /recommend|แนะนำ/iu.test(message)) ||
      (!caps.compareProducts && /compar|versus|\bvs\b|เปรียบเทียบ/iu.test(message)) ||
      (!caps.recommendRelatedProducts && /related|similar|เกี่ยวข้อง|คล้าย/iu.test(message)) ||
      (!caps.showPromotions && /promo|discount|sale|โปรโมชั่น|ส่วนลด/iu.test(message)) ||
      (!caps.showPrices && /price|cost|how much|ราคา|กี่บาท/iu.test(message)) ||
      (!caps.checkStock && /stock|available|เหลือ|สต็อก|มีไหม/iu.test(message));
    // Legacy free-text documents/history may contain untyped prices or stock.
    // Do not hand them to the LLM when those facts are disabled. Do not rewrite
    // or delete the persistent vector index to produce a filtered reply.
    const unstructuredFactsAllowed = caps.showPrices && caps.checkStock && caps.showPromotions && !denied;
    return { behavior: settings, capabilities: caps, denied,
      products: unstructuredFactsAllowed,
      knowledge: unstructuredFactsAllowed && caps.answerFaq,
      history: unstructuredFactsAllowed && caps.answerFaq && caps.recommendProducts && caps.compareProducts && caps.recommendRelatedProducts,
      // Read the complete stored index only when all its source kinds are allowed.
      storedVectors: unstructuredFactsAllowed && caps.answerFaq,
    };
  }
}
