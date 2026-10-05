import type { RagRetrieveRequest, RagRetrieveResult } from "../../types/ai-contract.types";
import { retrieveDocuments, tokenize, type RetrievalMode } from "../retrieval";
export { cosineSimilarity } from "../retrieval";

const contextFreeIntents = new Set(["empty_message", "language_preference", "small_talk"]);
export function isContextFreeIntent(intent: string): boolean { return contextFreeIntents.has(intent); }
export type EnhancedRagRequest = RagRetrieveRequest & { retrieval_mode?: RetrievalMode; candidate_limit?: number };

export class RagService {
  retrieve(input: EnhancedRagRequest = {}): RagRetrieveResult {
    const query = input.query?.trim() ?? "";
    const topK = Number.isInteger(input.top_k) ? Math.min(Math.max(input.top_k!, 1), 10) : 3;
    const configuredMode = process.env.AI_RETRIEVAL_MODE;
    const mode = input.retrieval_mode ?? (["dense", "bm25", "hybrid", "hybrid_rerank"].includes(configuredMode ?? "")
      ? configuredMode as RetrievalMode : "hybrid_rerank");
    return { mode: input.query_embedding?.length ? "hybrid_semantic" : "hybrid_lexical_fallback",
      query, top_k: topK,
      chunks: !query || isContextFreeIntent(input.intent ?? "") ? [] : retrieveDocuments(query,
        input.documents ?? [], input.query_embedding, { mode, topK, merchantId: input.merchant_id,
          intent: input.intent, candidateLimit: input.candidate_limit }),
    };
  }
}

/** Compatibility export; token coverage, not the BM25 ranking score. */
export function scoreLexicalSimilarity(query: string, document: string): number {
  const terms = [...new Set(tokenize(query))]; const tokens = new Set(tokenize(document));
  return terms.length ? terms.filter(term => tokens.has(term)).length / terms.length : 0;
}
