export const AI_TONES = ["friendly", "polite", "professional", "concise"] as const;
export const AI_LENGTHS = ["short", "medium", "detailed"] as const;
export const AI_FALLBACKS = ["notify_and_handoff", "handoff_immediately", "general_knowledge"] as const;

export interface AiCapabilities {
  recommendProducts: boolean;
  checkStock: boolean;
  compareProducts: boolean;
  answerFaq: boolean;
  showPrices: boolean;
  rememberCustomerInterest: boolean;
  showPromotions: boolean;
  recommendRelatedProducts: boolean;
}
export interface MerchantAiSettings {
  assistantName: string;
  pronoun: string;
  tone: typeof AI_TONES[number];
  language: "th" | "en";
  useEmoji: boolean;
  responseLength: typeof AI_LENGTHS[number];
  capabilities: AiCapabilities;
  rules: Array<{ id?: string; text: string; sortOrder: number }>;
  fallbackBehavior: typeof AI_FALLBACKS[number];
}
// The only application defaults. Neither browser nor LLM invents a second set.
export const DEFAULT_MERCHANT_AI_SETTINGS: Readonly<MerchantAiSettings> = Object.freeze({
  assistantName: "Chatto Assistant", pronoun: "ดิฉัน / ค่ะ", tone: "friendly", language: "th",
  useEmoji: true, responseLength: "medium",
  capabilities: Object.freeze({ recommendProducts: true, checkStock: true, compareProducts: true,
    answerFaq: true, showPrices: true, rememberCustomerInterest: true, showPromotions: true,
    recommendRelatedProducts: true }),
  rules: [], fallbackBehavior: "notify_and_handoff",
});
