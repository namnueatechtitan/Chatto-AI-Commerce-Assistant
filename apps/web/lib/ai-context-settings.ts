export type AiCapabilities = {
  recommendProducts: boolean;
  checkStock: boolean;
  compareProducts: boolean;
  answerFaq: boolean;
  showPrices: boolean;
  rememberCustomerInterest: boolean;
  showPromotions: boolean;
  recommendRelatedProducts: boolean;
};

export type AiContextSettings = {
  assistantName: string;
  pronoun: string;
  tone: "friendly" | "polite" | "professional" | "concise";
  language: "th" | "en";
  useEmoji: boolean;
  responseLength: "short" | "medium" | "detailed";
  capabilities: AiCapabilities;
  rules: Array<{ id: string; text: string }>;
  fallbackBehavior: "notify_and_handoff" | "handoff_immediately" | "general_knowledge";
};

export type AiSettingsResponse = Omit<AiContextSettings, "rules"> & {
  rules: Array<{ id?: string; text: string; sortOrder: number }>;
  canEdit: boolean;
};
export function settingsForForm(response: AiSettingsResponse): AiContextSettings {
  const { canEdit: _canEdit, ...settings } = response;
  return { ...settings, rules: settings.rules.map((rule, index) => ({ id: rule.id ?? `local-${index}`, text: rule.text })) };
}
export type AiContextPayload = Omit<AiContextSettings, "rules"> & { rules: Array<{ id?: string; text: string }> };

export function aiContextPayload(settings: AiContextSettings): AiContextPayload {
  return {
    ...settings,
    assistantName: settings.assistantName.trim(),
    capabilities: { ...settings.capabilities },
    rules: settings.rules.filter(rule => rule.text.trim()).map(rule => ({
      ...(rule.id.startsWith("local-") ? {} : { id: rule.id }), text: rule.text.trim(),
    })),
  };
}
