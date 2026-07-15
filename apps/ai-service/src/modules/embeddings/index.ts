import { createHash } from "node:crypto";

import type { VectorDocumentForAi } from "../../types/ai-contract.types";

type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[];
  };
  error?: {
    message?: string;
  };
}

export interface EmbeddingResult {
  model: string;
  dimensions: number;
  values: number[];
}

export interface DocumentEmbeddingResult {
  documents: VectorDocumentForAi[];
  generated: number;
  reused: number;
  errors: string[];
}

export class EmbeddingsService {
  private readonly apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  private readonly model =
    process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-2";
  private readonly dimensions = this.resolveDimensions();
  private readonly timeoutMs = this.resolveTimeoutMs();
  private readonly cache = new Map<string, number[]>();
  private readonly inFlight = new Map<string, Promise<number[]>>();

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  getModel(): string {
    return this.model;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  async embedQuery(text: string): Promise<EmbeddingResult> {
    return this.embedText(
      `task: search result | query: ${text.trim()}`,
      "RETRIEVAL_QUERY",
    );
  }

  async embedDocument(text: string, title: string): Promise<EmbeddingResult> {
    return this.embedText(
      `title: ${title.trim() || "none"} | text: ${text.trim()}`,
      "RETRIEVAL_DOCUMENT",
      title,
    );
  }

  async enrichDocuments(
    documents: VectorDocumentForAi[],
  ): Promise<DocumentEmbeddingResult> {
    let generated = 0;
    let reused = 0;
    const errors: string[] = [];
    const enrichedDocuments = [...documents];

    for (let offset = 0; offset < documents.length; offset += 4) {
      const batch = documents.slice(offset, offset + 4);
      const results = await Promise.all(
        batch.map(async (document, batchIndex) => {
          if (this.hasCurrentEmbedding(document)) {
            reused += 1;
            return document;
          }

          const title = this.getTitle(document);

          try {
            const embedding = await this.embedDocument(
              document.chunk_text,
              title,
            );
            generated += 1;

            return {
              ...document,
              embedding: embedding.values,
              metadata: {
                ...(document.metadata ?? {}),
                embedding_model: embedding.model,
                embedding_dimensions: embedding.dimensions,
                embedded_at: new Date().toISOString(),
              },
            };
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            errors.push(`${document.id ?? document.source_id}: ${reason}`);
            return document;
          }
        }),
      );

      results.forEach((document, batchIndex) => {
        enrichedDocuments[offset + batchIndex] = document;
      });
    }

    return {
      documents: enrichedDocuments,
      generated,
      reused,
      errors,
    };
  }

  async createEmbedding(text = "health check"): Promise<EmbeddingResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    return this.embedQuery(text);
  }

  private async embedText(
    text: string,
    taskType: EmbeddingTaskType,
    title?: string,
  ): Promise<EmbeddingResult> {
    if (!this.isConfigured()) {
      throw new Error("GEMINI_API_KEY is not configured for embeddings");
    }

    const cacheKey = this.cacheKey(text, taskType, title);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return {
        model: this.model,
        dimensions: cached.length,
        values: [...cached],
      };
    }

    let pending = this.inFlight.get(cacheKey);

    if (!pending) {
      pending = this.requestEmbedding(text, taskType, title);
      this.inFlight.set(cacheKey, pending);
    }

    try {
      const normalized = await pending;
      this.cache.set(cacheKey, normalized);
      this.trimCache();

      return {
        model: this.model,
        dimensions: normalized.length,
        values: [...normalized],
      };
    } finally {
      if (this.inFlight.get(cacheKey) === pending) {
        this.inFlight.delete(cacheKey);
      }
    }
  }

  private async requestEmbedding(
    text: string,
    taskType: EmbeddingTaskType,
    title?: string,
  ): Promise<number[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const modelPath = `models/${this.model}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${modelPath}:embedContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            model: modelPath,
            content: { parts: [{ text }] },
            embedContentConfig: {
              taskType,
              title: taskType === "RETRIEVAL_DOCUMENT" ? title : undefined,
              outputDimensionality: this.dimensions,
              autoTruncate: true,
            },
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as GeminiEmbeddingResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message ?? response.statusText);
      }

      const values = payload.embedding?.values;

      if (!Array.isArray(values) || values.length === 0) {
        throw new Error("Gemini returned an empty embedding");
      }

      return normalizeVector(values);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Gemini embedding timed out after ${this.timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private hasCurrentEmbedding(document: VectorDocumentForAi): boolean {
    return (
      Array.isArray(document.embedding) &&
      document.embedding.length === this.dimensions &&
      document.metadata?.embedding_model === this.model &&
      document.metadata?.embedding_dimensions === this.dimensions
    );
  }

  private getTitle(document: VectorDocumentForAi): string {
    return typeof document.metadata?.title === "string"
      ? document.metadata.title
      : document.source_id;
  }

  private cacheKey(
    text: string,
    taskType: EmbeddingTaskType,
    title?: string,
  ): string {
    return createHash("sha256")
      .update([this.model, this.dimensions, taskType, title ?? "", text].join("\n"))
      .digest("hex");
  }

  private trimCache(): void {
    while (this.cache.size > 256) {
      const oldestKey = this.cache.keys().next().value as string | undefined;

      if (!oldestKey) {
        return;
      }

      this.cache.delete(oldestKey);
    }
  }

  private resolveDimensions(): number {
    const configured = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS);

    if (Number.isInteger(configured) && configured >= 128 && configured <= 3072) {
      return configured;
    }

    return 768;
  }

  private resolveTimeoutMs(): number {
    const configured = Number(process.env.GEMINI_EMBEDDING_TIMEOUT_MS);

    if (Number.isFinite(configured) && configured >= 1000) {
      return configured;
    }

    return 10000;
  }
}

export function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(
    values.reduce((sum, value) => sum + value * value, 0),
  );

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Embedding vector has zero or invalid magnitude");
  }

  return values.map((value) => value / magnitude);
}
