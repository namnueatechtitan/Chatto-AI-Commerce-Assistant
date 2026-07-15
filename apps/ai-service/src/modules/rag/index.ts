import type {
  RagRetrievedChunk,
  RagRetrieveRequest,
  RagRetrieveResult,
  VectorDocumentForAi,
} from "../../types/ai-contract.types";

const defaultTopK = 3;

const intentSourceTypes: Record<string, string[]> = {
  product_search: ["product", "product_variant"],
  product_question: ["product", "product_variant"],
  recommendation: ["product", "product_variant"],
  shipping_question: ["shipping_policy", "faq"],
  payment_question: ["payment_policy", "faq"],
  return_question: ["return_policy", "faq"],
};

export class RagService {
  retrieve(input: RagRetrieveRequest = {}): RagRetrieveResult {
    const query = input.query?.trim() ?? "";
    const topK = this.normalizeTopK(input.top_k);
    const documents = input.documents ?? [];

    return {
      mode: "mcp_phase_2_placeholder",
      query,
      top_k: topK,
      chunks: this.rankDocuments(
        query,
        input.intent,
        input.merchant_id,
        documents,
      ).slice(0, topK),
    };
  }

  private rankDocuments(
    query: string,
    intent: string | undefined,
    merchantId: string | undefined,
    documents: VectorDocumentForAi[],
  ): RagRetrievedChunk[] {
    const allowedSourceTypes = intent ? intentSourceTypes[intent] : undefined;

    return documents
      .filter(
        (document) =>
          document.status.toLowerCase() === "active" &&
          (!merchantId || document.merchant_id === merchantId),
      )
      .map((document) =>
        this.toRetrievedChunk(query, document, allowedSourceTypes),
      )
      .filter((chunk) => chunk.score > 0)
      .sort((left, right) => right.score - left.score);
  }

  private toRetrievedChunk(
    query: string,
    document: VectorDocumentForAi,
    allowedSourceTypes: string[] | undefined,
  ): RagRetrievedChunk {
    const metadata = document.metadata ?? {};

    return {
      source_type: document.source_type,
      source_id: document.source_id,
      title: this.getTitle(metadata, document.source_id),
      chunk_text: document.chunk_text,
      score: this.score(query, document, allowedSourceTypes),
      metadata,
    };
  }

  private score(
    query: string,
    document: VectorDocumentForAi,
    allowedSourceTypes: string[] | undefined,
  ): number {
    const terms = query
      .toLowerCase()
      .split(/[\s,.;:!?()[\]{}]+/u)
      .filter(Boolean);

    if (terms.length === 0) {
      return 0;
    }

    const normalizedChunk = [
      document.chunk_text,
      typeof document.metadata?.title === "string"
        ? document.metadata.title
        : "",
    ]
      .join(" ")
      .toLowerCase();
    const matches = terms.filter((term) => normalizedChunk.includes(term));
    const lexicalScore = matches.length / terms.length;
    const intentScore = allowedSourceTypes?.includes(document.source_type)
      ? 0.6
      : 0;

    return Number(Math.min(lexicalScore + intentScore, 1).toFixed(4));
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
