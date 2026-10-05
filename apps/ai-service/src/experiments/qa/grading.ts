import type { QaAnswer } from "../../modules/qa/engine";
import type { QaCase } from "./dataset";

export interface ExactFactGrade {
  decision_correct: boolean;
  fact_groups_matched: number;
  fact_groups_total: number;
  exact_fact_pass: boolean | null;
  forbidden_pattern_pass: boolean;
  forbidden_matches: string[];
  claims_checked: number;
  unbound_claim_count: number;
  attempted_claims_checked: number;
  raw_unbound_selection_claim_count: number;
  source_binding_pass: boolean | null;
  gold_source_recall: number | null;
  answerable_fixture: boolean;
  answered: boolean;
  task_check_pass: boolean;
  note: string;
}

/** Mechanical screening only: exact facts and quote/source binding, not a hallucination judge. */
export function gradeAnswer(test: QaCase, result: QaAnswer): ExactFactGrade {
  const text = result.text.normalize("NFKC");
  const answered = result.decision === "answer";
  const matched = test.facts.filter(group => answered && group.patterns.some(pattern => new RegExp(pattern, "iu").test(text))).length;
  const forbiddenMatches = test.forbiddenPatterns.filter(pattern => new RegExp(pattern, "iu").test(text));
  const unbound = result.selectedClaims.filter(claim => {
    const source = result.sources.find(item => item.id === claim.source_id);
    return !source || !claim.quote.trim() || !source.text.includes(claim.quote);
  }).length;
  const attemptedClaims = (result.selectionAttempts ?? [result.rawSelection]).flatMap(attempt => {
    const claims = (attempt as { claims?: unknown } | undefined)?.claims;
    return Array.isArray(claims) ? claims : [];
  });
  const rawUnbound = attemptedClaims.filter((claim: unknown) => {
    if (!claim || typeof claim !== "object") return true;
    const item = claim as { source_id?: unknown; quote?: unknown };
    if (typeof item.source_id !== "string" || typeof item.quote !== "string" || !item.quote.trim()) return true;
    const source = result.sources.find(source => source.id === item.source_id);
    return !source || !source.text.includes(item.quote);
  }).length;
  const bindingPass = answered ? result.selectedClaims.length > 0 && unbound === 0 : null;
  const observedIds = new Set([...result.retrievedIds, ...result.sources.flatMap(source => [source.id, source.origin_id].filter((id): id is string => typeof id === "string")),
    ...(result.sqlRows ?? []).flatMap(row => [row.id, row.product_id].filter((id): id is string => typeof id === "string"))]);
  const sourceRecall = test.requiredSourceIds.length === 0 ? null
    : test.requiredSourceIds.filter(id => observedIds.has(id)).length / test.requiredSourceIds.length;
  const exactPass = test.facts.length === 0 ? null : matched === test.facts.length;
  const decisionCorrect = result.decision === test.expectedDecision;
  return {
    decision_correct: decisionCorrect, fact_groups_matched: matched, fact_groups_total: test.facts.length,
    exact_fact_pass: exactPass, forbidden_pattern_pass: forbiddenMatches.length === 0, forbidden_matches: forbiddenMatches,
    claims_checked: result.selectedClaims.length, unbound_claim_count: unbound, source_binding_pass: bindingPass,
    attempted_claims_checked: attemptedClaims.length, raw_unbound_selection_claim_count: rawUnbound,
    gold_source_recall: sourceRecall, answerable_fixture: test.expectedDecision === "answer", answered,
    task_check_pass: decisionCorrect && forbiddenMatches.length === 0 && (test.expectedDecision !== "answer" || (exactPass === true && bindingPass === true)),
    note: "Exact fact pattern coverage and contiguous final source-quote binding only. Raw unbound model selection quotes can be canonicalized into trusted SQL rows rather than rejected; their count is not a hallucination rate. Binding does not establish relevance, completeness, factual entailment, SQL intent accuracy or human-rated hallucination freedom.",
  };
}

export function retrievalMetrics(goldIds: string[], rankedIds: string[]): { recall_at_3: number; recall_at_5: number; reciprocal_rank_at_5: number } {
  if (goldIds.length === 0) throw new Error("Retrieval recall requires explicit positive gold sources");
  const unique = [...new Set(rankedIds)];
  const recall = (k: number): number => goldIds.filter(id => unique.slice(0, k).includes(id)).length / goldIds.length;
  const rank = unique.slice(0, 5).findIndex(id => goldIds.includes(id));
  return { recall_at_3: recall(3), recall_at_5: recall(5), reciprocal_rank_at_5: rank < 0 ? 0 : 1 / (rank + 1) };
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * p;
  const low = Math.floor(at);
  return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low);
}

export function shuffled<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
