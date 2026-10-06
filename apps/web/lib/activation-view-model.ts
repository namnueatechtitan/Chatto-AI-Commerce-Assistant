import type { ActivationReadiness } from "./merchant-activation-api";

export interface ReadinessStatus {
  id: "store" | "line" | "knowledge" | "context";
  title: string;
  description: string;
  ready: boolean;
}
export interface ActiveChannel {
  platform: "LINE";
  platformName: string;
  storeName: string;
  connected: boolean;
}
export interface AiSummary {
  assistantName: string;
  tone: string;
  fallbackBehavior: string;
}
export interface ActivationViewModel {
  readinessItems: ReadinessStatus[];
  channel: ActiveChannel;
  aiSummary: AiSummary;
}

const toneLabels: Record<string, string> = {
  friendly: "เป็นกันเอง", polite: "สุภาพ", professional: "มืออาชีพ", concise: "กระชับ",
};
const fallbackLabels: Record<string, string> = {
  notify_and_handoff: "แจ้งลูกค้า และส่งต่อแอดมิน",
  handoff_immediately: "ส่งต่อให้แอดมินทันที",
  general_knowledge: "ตอบจากความรู้ทั่วไป",
};

// Presentation only: every check and the aggregate ready flag come from the API.
export function activationViewModel(response: ActivationReadiness): ActivationViewModel {
  const descriptions = {
    store: "ตรวจสอบข้อมูลร้านที่จำเป็น", line: "ตรวจสอบบัญชี LINE และหลักฐาน Webhook",
    knowledge: `${response.checks.knowledge.ready ? "ข้อมูลร้านพร้อมใช้" : "ข้อมูลร้านยังไม่ครบ"} · สินค้า ${response.checks.knowledge.productsCount} รายการ · FAQ ${response.checks.knowledge.faqCount} รายการ (ไม่บังคับ)`,
    aiContext: "ตรวจสอบบริบทและแนวทางการตอบที่บันทึกไว้",
  };
  return {
    readinessItems: (["store", "line", "knowledge", "aiContext"] as const).map(key => ({
      id: key === "aiContext" ? "context" : key, title: response.checks[key].title,
      ready: response.checks[key].ready, description: descriptions[key],
    })),
    channel: { platform: response.channel.platform, platformName: "LINE Official Account", storeName: response.channel.displayName, connected: response.channel.connected },
    aiSummary: { assistantName: response.aiSummary.assistantName || "ยังไม่ได้บันทึก", tone: toneLabels[response.aiSummary.tone] ?? "ยังไม่ได้บันทึก",
      fallbackBehavior: fallbackLabels[response.aiSummary.fallbackBehavior] ?? "ยังไม่ได้บันทึก" },
  };
}
