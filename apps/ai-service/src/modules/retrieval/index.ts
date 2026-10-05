import { createHash } from "node:crypto";
import type { RagRetrievedChunk, VectorDocumentForAi } from "../../types/ai-contract.types";
import { Bm25Index, normalizeSearchText, tokenize } from "./bm25";
export { Bm25Index, normalizeSearchText, tokenize } from "./bm25";
export { KnowledgeIndex, type KnowledgeSnapshot } from "./knowledge-index";

export type RetrievalMode = "dense" | "bm25" | "hybrid" | "hybrid_rerank";
export interface RetrievalOptions {
  mode?: RetrievalMode; topK?: number; candidateLimit?: number;
  merchantId?: string; intent?: string;
}
const sourceTypes: Record<string, string[]> = {
  product_search: ["product", "product_variant"], product_question: ["product", "product_variant"],
  recommendation: ["product", "product_variant"], shipping_question: ["shipping_policy", "faq"],
  payment_question: ["payment_policy", "faq"], return_question: ["return_policy", "faq"],
};
const bm25Cache = new Map<string, Bm25Index>();

function corpusIndex(documents: VectorDocumentForAi[]): Bm25Index {
  // Include order and tenant in the fingerprint: indices must never reference a different corpus.
  const texts = documents.map(document => [document.merchant_id, document.id ?? document.source_id,
    document.chunk_text, String(document.metadata?.title ?? "")].join("\n"));
  const key = createHash("sha256").update(JSON.stringify(texts)).digest("hex");
  const cached = bm25Cache.get(key);
  if (cached) return cached;
  const index = new Bm25Index(documents.map(document => `${String(document.metadata?.title ?? "")} ${document.chunk_text}`));
  bm25Cache.set(key, index);
  while (bm25Cache.size > 16) bm25Cache.delete(bm25Cache.keys().next().value!);
  return index;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length || !left.every(Number.isFinite) || !right.every(Number.isFinite)) return 0;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index++) {
    dot += left[index] * right[index]; leftMagnitude += left[index] ** 2; rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator > 0 ? Math.min(1, Math.max(-1, dot / denominator)) : 0;
}

/** RRF uses ranks, avoiding arbitrary addition of cosine and unbounded BM25 scores. */
export function reciprocalRankFusion(rankings: number[][], k = 60): Map<number, number> {
  if (!Number.isFinite(k) || k < 0) throw new Error("RRF constant must be finite and nonnegative");
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    const seen = new Set<number>();
    ranking.forEach((id, rank) => {
      if (seen.has(id)) return;
      seen.add(id); scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return scores;
}

function exactEntity(query: string, document: VectorDocumentForAi): number {
  const text = normalizeSearchText(document.chunk_text);
  const compounds = normalizeSearchText(query).match(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)+/gu) ?? [];
  if (compounds.length) return compounds.filter(term => tokenize(text).includes(term)).length / compounds.length;
  const title = normalizeSearchText(String(document.metadata?.title ?? ""));
  return title.length >= 3 && normalizeSearchText(query).includes(title) ? 1 : 0;
}

export function retrieveDocuments(
  query: string, inputDocuments: VectorDocumentForAi[], queryEmbedding?: number[], options: RetrievalOptions = {},
): RagRetrievedChunk[] {
  const mode = options.mode ?? "hybrid";
  if (!["dense", "bm25", "hybrid", "hybrid_rerank"].includes(mode)) throw new Error("Invalid retrieval mode");
  const topK = boundedInteger(options.topK, 3, 1, 10);
  const limit = boundedInteger(options.candidateLimit, 40, topK, 200);
  const allowed = options.intent ? sourceTypes[options.intent] : undefined;
  // Without a scope only a single-tenant corpus is accepted. Never search across merchants.
  const tenants = new Set(inputDocuments.map(document => document.merchant_id));
  if (!options.merchantId && tenants.size > 1) throw new Error("MERCHANT_SCOPE_REQUIRED");
  const documents = inputDocuments.filter(document => document.status.toLowerCase() === "active"
    && (!options.merchantId || document.merchant_id === options.merchantId)
    && (!allowed || allowed.includes(document.source_type)));
  if (!query.trim() || !documents.length) return [];
  const lexical = corpusIndex(documents).search(query);
  const lexicalById = new Map(lexical.map(hit => [hit.index, hit]));
  const dense = documents.flatMap((document, index) => {
    const similarity = queryEmbedding && document.embedding ? Math.max(0, cosineSimilarity(queryEmbedding, document.embedding)) : 0;
    return similarity > 0 ? [{ index, score: similarity }] : [];
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const denseById = new Map(dense.map(hit => [hit.index, hit.score]));
  const lexicalRanking = lexical.slice(0, limit).map(hit => hit.index);
  const denseRanking = dense.slice(0, limit).map(hit => hit.index);
  const rankings = mode === "dense" ? [denseRanking] : mode === "bm25" ? [lexicalRanking]
    : queryEmbedding?.length ? [denseRanking, lexicalRanking] : [lexicalRanking];
  const fused = reciprocalRankFusion(rankings);
  const maxRrf = rankings.length / 61;
  const candidates = [...fused].sort((left, right) => right[1] - left[1]).slice(0, limit).map(([index, rrf]) => {
    const document = documents[index];
    const lexicalHit = lexicalById.get(index); const semantic = denseById.get(index);
    const normalizedRrf = rrf / maxRrf;
    let score = mode === "dense" ? semantic ?? 0 : mode === "bm25" ? (lexicalHit?.score ?? 0) / (1 + (lexicalHit?.score ?? 0)) : normalizedRrf;
    const entity = exactEntity(query, document);
    // Explicitly a deterministic reranker, not a neural cross-encoder or factual verifier.
    if (mode === "hybrid_rerank") score = 0.55 * normalizedRrf + 0.25 * (lexicalHit?.coverage ?? 0) + 0.2 * entity;
    return { source_type: document.source_type, source_id: document.source_id,
      title: typeof document.metadata?.title === "string" ? document.metadata.title : document.source_id,
      chunk_text: document.chunk_text, score: rounded(score), semantic_score: semantic,
      lexical_score: rounded(lexicalHit?.coverage ?? 0), intent_score: allowed ? 1 : 0,
      metadata: { ...(document.metadata ?? {}), retrieval_mode: mode, bm25_score: lexicalHit?.score ?? 0,
        rrf_score: rrf, exact_entity_score: entity, candidate_limit: limit,
        reranker: mode === "hybrid_rerank" ? "deterministic-entity-coverage-v1" : "none" } };
  });
  return candidates.sort((left, right) => right.score - left.score).slice(0, topK);
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value!)) : fallback;
}
function rounded(value: number): number { return Number(Math.min(1, Math.max(0, value)).toFixed(4)); }
