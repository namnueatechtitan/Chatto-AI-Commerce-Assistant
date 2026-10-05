import { createHash } from "node:crypto";
import type { VectorDocumentForAi } from "../../types/ai-contract.types";

export type EmbeddingProvider = "ollama" | "gemini" | "none";
type Task = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
export interface EmbeddingOptions {
  provider?: EmbeddingProvider; model?: string; dimensions?: number;
  baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch;
}
export interface EmbeddingResult { model: string; dimensions: number; values: number[] }
export interface DocumentEmbeddingResult {
  documents: VectorDocumentForAi[]; generated: number; reused: number; errors: string[];
}

/** Local inference by default; Gemini requires an explicit provider selection. */
export class EmbeddingsService {
  private readonly provider: EmbeddingProvider;
  private readonly model: string;
  private readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  private readonly cache = new Map<string, number[]>();
  private readonly inFlight = new Map<string, Promise<number[]>>();

  constructor(options: EmbeddingOptions = {}) {
    const provider = options.provider ?? process.env.AI_EMBEDDING_PROVIDER ?? "ollama";
    if (!["ollama", "gemini", "none"].includes(provider)) throw new Error("AI_EMBEDDING_PROVIDER must be ollama, gemini, or none");
    this.provider = provider as EmbeddingProvider;
    this.model = options.model ?? (this.provider === "gemini"
      ? process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-2"
      : process.env.OLLAMA_EMBEDDING_MODEL?.trim() || "bge-m3");
    const dimensions = options.dimensions ?? Number(this.provider === "gemini" ? process.env.GEMINI_EMBEDDING_DIMENSIONS : process.env.OLLAMA_EMBEDDING_DIMENSIONS);
    this.dimensions = Number.isInteger(dimensions) && dimensions >= 1 && dimensions <= 4096 ? dimensions : this.provider === "gemini" ? 768 : 1024;
    this.baseUrl = (options.baseUrl ?? process.env.OLLAMA_BASE_URL?.trim() ?? "http://127.0.0.1:11434").replace(/\/+$/u, "");
    const timeout = options.timeoutMs ?? Number(process.env.AI_EMBEDDING_TIMEOUT_MS ?? process.env.GEMINI_EMBEDDING_TIMEOUT_MS);
    this.timeoutMs = Number.isFinite(timeout) && timeout >= 1000 ? timeout : 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }
  isConfigured(): boolean {
    if (this.provider === "none") return false;
    if (this.provider === "gemini") return Boolean(this.apiKey);
    try { return ["http:", "https:"].includes(new URL(this.baseUrl).protocol); } catch { return false; }
  }
  getProvider(): EmbeddingProvider { return this.provider; }
  getModel(): string { return this.model; }
  getDimensions(): number { return this.dimensions; }
  getIdentity(): string { return `${this.provider}:${this.model}:${this.dimensions}`; }
  async embedQuery(text: string): Promise<EmbeddingResult> { return this.embedText(text.trim(), "RETRIEVAL_QUERY"); }
  async embedDocument(text: string, title: string): Promise<EmbeddingResult> { return this.embedText(text.trim(), "RETRIEVAL_DOCUMENT", title.trim()); }
  async createEmbedding(text = "health check"): Promise<EmbeddingResult | null> { return this.isConfigured() ? this.embedQuery(text) : null; }

  async enrichDocuments(documents: VectorDocumentForAi[]): Promise<DocumentEmbeddingResult> {
    let generated = 0; let reused = 0;
    const errors: string[] = []; const result: VectorDocumentForAi[] = [];
    for (let offset = 0; offset < documents.length; offset += 3) {
      result.push(...await Promise.all(documents.slice(offset, offset + 3).map(async document => {
        const title = typeof document.metadata?.title === "string" ? document.metadata.title : document.source_id;
        const fingerprint = this.documentFingerprint(document.chunk_text, title);
        if (this.hasCurrentEmbedding(document, fingerprint)) { reused++; return document; }
        try {
          const embedding = await this.embedDocument(document.chunk_text, title); generated++;
          return { ...document, embedding: embedding.values, metadata: { ...(document.metadata ?? {}),
            embedding_provider: this.provider, embedding_model: embedding.model, embedding_dimensions: embedding.dimensions,
            embedding_content_hash: fingerprint, embedded_at: new Date().toISOString() } };
        } catch (error) {
          errors.push(`${document.id ?? document.source_id}: ${error instanceof Error ? error.message : String(error)}`);
          // Never let failed refreshes retain stale vectors from different text/models.
          return { ...document, embedding: null };
        }
      })));
    }
    return { documents: result, generated, reused, errors };
  }
  private documentFingerprint(text: string, title: string): string {
    return createHash("sha256").update(`${title.normalize("NFKC").trim()}\n${text.normalize("NFKC").trim()}`).digest("hex");
  }
  private hasCurrentEmbedding(document: VectorDocumentForAi, hash: string): boolean {
    return Array.isArray(document.embedding) && document.embedding.length === this.dimensions && document.embedding.every(Number.isFinite)
      && document.metadata?.embedding_model === this.model && document.metadata?.embedding_dimensions === this.dimensions
      && document.metadata?.embedding_provider === this.provider && document.metadata?.embedding_content_hash === hash;
  }
  private async embedText(text: string, task: Task, title = ""): Promise<EmbeddingResult> {
    if (!this.isConfigured()) throw new Error("Embedding provider is not configured");
    if (!text) throw new Error("Embedding input must not be empty");
    const key = createHash("sha256").update([this.getIdentity(), task, title, text].join("\n")).digest("hex");
    const cached = this.cache.get(key);
    if (cached) return { model: this.model, dimensions: cached.length, values: [...cached] };
    let pending = this.inFlight.get(key);
    if (!pending) { pending = this.requestEmbedding(text, task, title); this.inFlight.set(key, pending); }
    try {
      const values = await pending; this.cache.set(key, values);
      while (this.cache.size > 256) this.cache.delete(this.cache.keys().next().value!);
      return { model: this.model, dimensions: values.length, values: [...values] };
    } finally { if (this.inFlight.get(key) === pending) this.inFlight.delete(key); }
  }
  private async requestEmbedding(text: string, task: Task, title: string): Promise<number[]> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const local = this.provider === "ollama"; const modelPath = `models/${this.model}`;
      const response = await this.fetchImpl(local ? `${this.baseUrl}/api/embed` : `https://generativelanguage.googleapis.com/v1beta/${modelPath}:embedContent`, {
        method: "POST", signal: controller.signal,
        headers: local ? { "Content-Type": "application/json" } : { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(local ? { model: this.model, input: text, truncate: false, keep_alive: "15m" }
          : { model: modelPath, content: { parts: [{ text }] }, taskType: task,
            title: task === "RETRIEVAL_DOCUMENT" ? title : undefined, outputDimensionality: this.dimensions }),
      });
      const payload = await response.json().catch(() => ({})) as { embeddings?: unknown[][]; embedding?: { values?: unknown[] } };
      if (!response.ok) throw new Error(`Embedding provider HTTP ${response.status}`);
      const values = local ? payload.embeddings?.[0] : payload.embedding?.values;
      if (!Array.isArray(values) || values.length !== this.dimensions || !values.every(value => typeof value === "number" && Number.isFinite(value))) {
        throw new Error(`Embedding provider must return ${this.dimensions} finite dimensions`);
      }
      return normalizeVector(values as number[]);
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Embedding request timed out after ${this.timeoutMs}ms`);
      throw error;
    } finally { clearTimeout(timer); }
  }
}

export function normalizeVector(values: number[]): number[] {
  if (!values.length || !values.every(Number.isFinite)) throw new Error("Embedding vector has invalid values");
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new Error("Embedding vector has zero or invalid magnitude");
  return values.map(value => value / magnitude);
}
