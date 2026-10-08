import type { VectorDocumentForAi } from "../../types/ai-contract.types";
import { configuredServiceToken } from "../../service-auth";
import { cancellationCategory, operationControl, type RequestControl } from "../../request-budget";

export interface VectorSyncResult {
  merchant_id: string;
  upserted: number;
  deleted: number;
}

export class VectorStoreClient {
  private readonly baseUrl =
    process.env.INTERNAL_API_BASE_URL?.trim() || "http://localhost:4000";
  private readonly timeoutMs = 10_000;

  async syncDocuments(
    merchantId: string,
    documents: VectorDocumentForAi[],
    requestControl?: RequestControl,
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

    const token = configuredServiceToken("INTERNAL_SERVICE_TOKEN");

    const control = operationControl(Math.min(this.timeoutMs, requestControl?.timeoutMs ?? this.timeoutMs), requestControl?.signal);

    try {
      if (control.signal.aborted) throw new Error(cancellationCategory(control.signal));
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/u, "")}/internal/ai/vector-documents/sync`,
        {
          method: "POST",
          signal: control.signal,
          headers: {
            Authorization: `Bearer ${token}`,
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

      const result = (await response.json()) as VectorSyncResult;
      if (control.signal.aborted) throw new Error(cancellationCategory(control.signal));
      return result;
    } catch (error) {
      if (control.signal.aborted) throw new Error(cancellationCategory(control.signal));
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Vector sync timed out after ${this.timeoutMs}ms`);
      }

      throw error;
    } finally {
      control.dispose();
    }
  }
}
