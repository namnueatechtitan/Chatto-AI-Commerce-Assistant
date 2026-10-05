import type { VectorDocumentForAi } from "../../types/ai-contract.types";

export interface VectorSyncResult {
  merchant_id: string;
  upserted: number;
  deleted: number;
}

export class VectorStoreClient {
  private readonly baseUrl =
    process.env.INTERNAL_API_BASE_URL?.trim() || "http://localhost:4000";
  private readonly token =
    process.env.INTERNAL_SERVICE_TOKEN?.trim() || "dev_internal_service_token";
  private readonly timeoutMs = 10_000;

  async syncDocuments(
    merchantId: string,
    documents: VectorDocumentForAi[],
  ): Promise<VectorSyncResult> {
    const managedDocuments = documents.filter(
      (document) =>
        document.merchant_id === merchantId &&
        document.metadata?.managed_by === "chatto-live-chunker" &&
        Array.isArray(document.embedding) &&
        document.embedding.length > 0,
    );

    if (managedDocuments.length === 0) {
      return { merchant_id: merchantId, upserted: 0, deleted: 0 };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/u, "")}/internal/ai/vector-documents/sync`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            merchant_id: merchantId,
            documents: managedDocuments,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Vector sync failed with ${response.status}: ${body || response.statusText}`,
        );
      }

      return (await response.json()) as VectorSyncResult;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Vector sync timed out after ${this.timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
