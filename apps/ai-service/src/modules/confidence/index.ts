import type { RagRetrievedChunk } from "../../types/ai-contract.types";

export interface ConfidenceResult {
  score: number;
  threshold: number;
  level: "high" | "medium" | "low";
  decision: "answer" | "handover";
  reasons: string[];
  signals: { intent: number; evidence: number; source_count: number };
}

export const CONTEXT_FREE_INTENTS = new Set(["small_talk", "language_preference"]);

function unit(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value)) : 0;
}

export function resolveHandoverThreshold(value?: number): number {
  const configured = value ?? Number(process.env.AI_HANDOVER_THRESHOLD || "0.65");
  return Number.isFinite(configured) && configured > 0 && configured <= 1
    ? configured : 0.65;
}

/** Evidence heuristic, NOT a calibrated probability that an answer is correct. */
export class ConfidenceService {
  evaluate(input: {
    intent: string;
    intent_confidence: number;
    chunks: RagRetrievedChunk[];
    threshold?: number;
    blocked?: boolean;
    force_handover?: boolean;
  }): ConfidenceResult {
    const threshold = resolveHandoverThreshold(input.threshold);
    const intent = unit(input.intent_confidence);
    const contextFree = CONTEXT_FREE_INTENTS.has(input.intent);
    // RAG source-type compatibility is not evidence of factual relevance.
    const evidence = Math.max(0, ...input.chunks.map(chunk =>
      Math.max(unit(chunk.semantic_score), unit(chunk.lexical_score))));
    const reasons: string[] = [];
    let score = contextFree ? intent : 0.2 * intent + 0.8 * evidence;
    if (!contextFree && input.chunks.length === 0) {
      score = Math.min(score, 0.2);
      reasons.push("NO_EVIDENCE");
    } else if (!contextFree && evidence < 0.35) {
      score = Math.min(score, 0.34);
      reasons.push("WEAK_EVIDENCE");
    }
    if (["unknown", "empty_message"].includes(input.intent)) {
      score = Math.min(score, 0.3);
      reasons.push("UNCLEAR_INTENT");
    }
    if (input.blocked) {
      score = 0;
      reasons.push("GUARDRAIL_BLOCKED");
    }
    if (input.force_handover) reasons.push("HUMAN_REVIEW_REQUIRED");
    score = Number(score.toFixed(4));
    if (score < threshold) reasons.push("BELOW_THRESHOLD");
    return {
      score, threshold,
      level: score >= 0.8 ? "high" : score >= threshold ? "medium" : "low",
      decision: reasons.length > 0 ? "handover" : "answer",
      reasons,
      signals: { intent, evidence, source_count: input.chunks.length },
    };
  }
}
