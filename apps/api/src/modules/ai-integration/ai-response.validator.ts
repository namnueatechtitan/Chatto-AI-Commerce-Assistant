import type { AiChatRequest, AiChatResponse } from "./ai-contract.types";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function score(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string" && item.length <= 100);
}

/** Do not deliver or persist a malformed response or one for another tenant. */
export function assertAiChatResponse(value: unknown, request: AiChatRequest): asserts value is AiChatResponse {
  if (!record(value) || value.request_id !== request.request_id || value.merchant_id !== request.merchant_id ||
    value.conversation_id !== request.conversation_id || typeof value.intent !== "string" ||
    !record(value.reply) || typeof value.reply.text !== "string" || !value.reply.text.trim() || value.reply.text.length > 4500 ||
    !score(value.reply.confidence) || typeof value.handover_required !== "boolean" ||
    (value.handover_reason !== undefined && (typeof value.handover_reason !== "string" || value.handover_reason.length > 100)) ||
    !Array.isArray(value.actions) || value.actions.length !== 0 ||
    !record(value.confidence) || !score(value.confidence.score) || value.confidence.score !== value.reply.confidence ||
    !score(value.confidence.threshold) || value.confidence.threshold === 0 ||
    !["high", "medium", "low"].includes(String(value.confidence.level)) ||
    !strings(value.confidence.reasons) || !record(value.confidence.signals) ||
    !score(value.confidence.signals.intent) || !score(value.confidence.signals.evidence) ||
    !Number.isInteger(value.confidence.signals.source_count) ||
    value.confidence.decision !== (value.handover_required ? "handover" : "answer") ||
    (!value.handover_required && value.reply.confidence < value.confidence.threshold) ||
    !Array.isArray(value.guardrails) || value.guardrails.length === 0 ||
    !value.guardrails.every(check => record(check) && typeof check.allowed === "boolean" &&
      ["low", "medium", "high"].includes(String(check.severity)) &&
      ["input", "context", "output"].includes(String(check.stage)) && strings(check.reasons) &&
      typeof check.requires_handover === "boolean" &&
      (value.handover_required || (check.allowed && !check.requires_handover)))) {
    throw new Error("INVALID_AI_SERVICE_RESPONSE");
  }
}
