import type {
  RagRetrievedChunk,
  RagRetrieveRequest,
  RagRetrieveResult,
  VectorDocumentForAi,
} from "../../types/ai-contract.types";

const defaultTopK = 3;
const semanticWeight = 0.65;
const lexicalWeight = 0.25;
const intentWeight = 0.1;

const intentSourceTypes: Record<string, string[]> = {
  product_search: ["product", "product_variant"],
  product_question: ["product", "product_variant"],
  recommendation: ["product", "product_variant"],
  shipping_question: ["shipping_policy", "faq"],
  payment_question: ["payment_policy", "faq"],
  return_question: ["return_policy", "faq"],
};

const contextFreeIntents = new Set([
  "empty_message",
  "language_preference",
  "small_talk",
]);

export class RagService {
  retrieve(input: RagRetrieveRequest = {}): RagRetrieveResult {
    const query = input.query?.trim() ?? "";
    const topK = this.normalizeTopK(input.top_k);
    const documents = input.documents ?? [];
    const hasQueryEmbedding = Boolean(input.query_embedding?.length);

    if (!query || contextFreeIntents.has(input.intent ?? "")) {
      return {
        mode: hasQueryEmbedding
          ? "hybrid_semantic"
          : "hybrid_lexical_fallback",
        query,
        top_k: topK,
        chunks: [],
      };
    }

    return {
      mode: hasQueryEmbedding
        ? "hybrid_semantic"
        : "hybrid_lexical_fallback",
      query,
      top_k: topK,
      chunks: this.rankDocuments(
        query,
        input.intent,
        input.merchant_id,
        input.query_embedding,
        documents,
      ).slice(0, topK),
    };
  }

  private rankDocuments(
    query: string,
    intent: string | undefined,
    merchantId: string | undefined,
    queryEmbedding: number[] | undefined,
    documents: VectorDocumentForAi[],
  ): RagRetrievedChunk[] {
    const allowedSourceTypes = intent ? intentSourceTypes[intent] : undefined;

    return documents
      .filter(
        (document) =>
          document.status.toLowerCase() === "active" &&
          (!merchantId || document.merchant_id === merchantId) &&
          (!allowedSourceTypes || allowedSourceTypes.includes(document.source_type)),
      )
      .map((document) =>
        this.toRetrievedChunk(
          query,
          document,
          queryEmbedding,
          allowedSourceTypes,
        ),
      )
      .filter((chunk) => this.meetsThreshold(chunk, Boolean(queryEmbedding)))
      .sort((left, right) => right.score - left.score);
  }

  private toRetrievedChunk(
    query: string,
    document: VectorDocumentForAi,
    queryEmbedding: number[] | undefined,
    allowedSourceTypes: string[] | undefined,
  ): RagRetrievedChunk {
    const metadata = document.metadata ?? {};
    const lexicalScore = scoreLexicalSimilarity(
      query,
      [
        document.chunk_text,
        typeof metadata.title === "string" ? metadata.title : "",
      ].join(" "),
    );
    const semanticScore =
      queryEmbedding && document.embedding?.length === queryEmbedding.length
        ? Math.max(cosineSimilarity(queryEmbedding, document.embedding), 0)
        : undefined;
    const intentScore = allowedSourceTypes?.includes(document.source_type) ? 1 : 0;
    const score = this.hybridScore(
      semanticScore,
      lexicalScore,
      intentScore,
    );

    return {
      source_type: document.source_type,
      source_id: document.source_id,
      title: this.getTitle(metadata, document.source_id),
      chunk_text: document.chunk_text,
      score,
      semantic_score: semanticScore,
      lexical_score: lexicalScore,
      intent_score: intentScore,
      metadata,
    };
  }

  private hybridScore(
    semanticScore: number | undefined,
    lexicalScore: number,
    intentScore: number,
  ): number {
    if (semanticScore === undefined) {
      return Number((lexicalScore * 0.65 + intentScore * 0.35).toFixed(4));
    }

    return Number(
      (
        semanticScore * semanticWeight +
        lexicalScore * lexicalWeight +
        intentScore * intentWeight
      ).toFixed(4),
    );
  }

  private meetsThreshold(
    chunk: RagRetrievedChunk,
    hasQueryEmbedding: boolean,
  ): boolean {
    // Keep type-compatible candidates for cross-language retrieval; the separate
    // confidence gate must require lexical/semantic evidence before answering.
    if (chunk.intent_score > 0 && chunk.score >= 0.18) {
      return true;
    }

    return hasQueryEmbedding
      ? (chunk.semantic_score ?? 0) >= 0.3 || chunk.lexical_score >= 0.2
      : chunk.lexical_score >= 0.2;
  }

  private normalizeTopK(topK?: number): number {
    if (topK === undefined || !Number.isInteger(topK)) {
      return defaultTopK;
    }

    return Math.min(Math.max(topK, 1), 10);
  }

  private getTitle(metadata: Record<string, unknown>, fallback: string): string {
    return typeof metadata.title === "string" ? metadata.title : fallback;
  }
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);

  return denominator > 0 ? dotProduct / denominator : 0;
}

export function scoreLexicalSimilarity(query: string, document: string): number {
  const normalizedQuery = normalizeForSearch(query);
  const normalizedDocument = normalizeForSearch(document);

  if (!normalizedQuery || !normalizedDocument) {
    return 0;
  }

  const queryTerms = normalizedQuery.split(/\s+/u).filter(Boolean);
  const matchingTerms = queryTerms.filter((term) =>
    normalizedDocument.includes(term),
  );
  const termScore = matchingTerms.length / Math.max(queryTerms.length, 1);
  const queryNgrams = characterNgrams(normalizedQuery.replace(/\s+/g, ""), 2);
  const documentNgrams = characterNgrams(
    normalizedDocument.replace(/\s+/g, ""),
    2,
  );
  const ngramScore = diceCoefficient(queryNgrams, documentNgrams);

  return Number(Math.max(termScore, ngramScore).toFixed(4));
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function characterNgrams(value: string, size: number): Set<string> {
  const characters = Array.from(value);
  const grams = new Set<string>();

  for (let index = 0; index <= characters.length - size; index += 1) {
    grams.add(characters.slice(index, index + size).join(""));
  }

  return grams;
}

function diceCoefficient(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (left.size + right.size);
}
