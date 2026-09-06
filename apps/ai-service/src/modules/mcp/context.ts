import type { AiContextForRequest, VectorDocumentForAi } from "../../types/ai-contract.types";
import { buildProductKnowledgeDocuments, buildKnowledgeBaseDocuments, toVectorDocumentRows } from "../rag/vector-document.builder";

export function buildVectorDocumentsFromContext(
  aiContext: AiContextForRequest | undefined,
): VectorDocumentForAi[] {
  if (!aiContext) {
    return [];
  }

  const productDocuments = aiContext.products
    ? buildProductKnowledgeDocuments(aiContext.products)
    : [];
  const knowledgeDocuments = aiContext.knowledge_base
    ? buildKnowledgeBaseDocuments(aiContext.knowledge_base)
    : [];

  const liveDocuments = toVectorDocumentRows([
    ...productDocuments,
    ...knowledgeDocuments,
  ]).map(
    (row) => ({
      id: row.id,
      merchant_id: row.merchantId,
      source_type: row.sourceType,
      source_id: row.sourceId,
      chunk_text: row.chunkText,
      embedding: row.embedding,
      metadata: row.metadata,
      status: row.status,
    }),
  );

  const storedById = new Map(
    (aiContext.vector_documents ?? [])
      .filter((document) => Boolean(document.id))
      .map((document) => [document.id!, document]),
  );
  const mergedLiveDocuments = liveDocuments.map((document) => {
    const stored = document.id ? storedById.get(document.id) : undefined;
    const contentUnchanged =
      stored?.metadata?.content_hash === document.metadata?.content_hash;

    if (!stored || !contentUnchanged || !Array.isArray(stored.embedding)) {
      return document;
    }

    return {
      ...document,
      embedding: stored.embedding,
      metadata: {
        ...(document.metadata ?? {}),
        embedding_model: stored.metadata?.embedding_model,
        embedding_dimensions: stored.metadata?.embedding_dimensions,
        embedded_at: stored.metadata?.embedded_at,
      },
    };
  });
  const liveIds = new Set(mergedLiveDocuments.map((document) => document.id));
  const additionalStoredDocuments = (aiContext.vector_documents ?? []).filter(
    (document) =>
      document.metadata?.managed_by !== "chatto-live-chunker" &&
      (!document.id || !liveIds.has(document.id)),
  );

  return [...mergedLiveDocuments, ...additionalStoredDocuments];
}
