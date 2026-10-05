import { createHash } from "node:crypto";
import type { VectorDocumentForAi } from "../../types/ai-contract.types";

export interface KnowledgeSnapshot {
  merchantId: string; version: string; updatedAt: string; documents: VectorDocumentForAi[];
}

/** Atomic, bounded tenant snapshots. The caller controls persistence and refresh scheduling. */
export class KnowledgeIndex {
  private readonly snapshots = new Map<string, KnowledgeSnapshot>();
  private readonly pending = new Map<string, Promise<KnowledgeSnapshot>>();
  private readonly maxMerchants: number;
  constructor(options: { maxMerchants?: number } = {}) {
    this.maxMerchants = Number.isInteger(options.maxMerchants) && options.maxMerchants! > 0 ? options.maxMerchants! : 32;
  }
  async refresh(merchantId: string, loader: () => Promise<VectorDocumentForAi[]>): Promise<KnowledgeSnapshot> {
    const current = this.pending.get(merchantId);
    if (current) return structuredClone(await current);
    const pending = this.load(merchantId, loader);
    this.pending.set(merchantId, pending);
    try { return structuredClone(await pending); }
    finally { if (this.pending.get(merchantId) === pending) this.pending.delete(merchantId); }
  }
  private async load(merchantId: string, loader: () => Promise<VectorDocumentForAi[]>): Promise<KnowledgeSnapshot> {
    const documents = await loader();
    if (!merchantId || documents.some(document => document.merchant_id !== merchantId)) throw new Error("MERCHANT_SCOPE_MISMATCH");
    const active = documents.filter(document => document.status.toLowerCase() === "active");
    const keys = active.map(document => document.id ?? `${document.source_type}:${document.source_id}:${document.metadata?.chunk_index ?? 0}`);
    if (new Set(keys).size !== keys.length) throw new Error("DUPLICATE_INDEX_DOCUMENT");
    const snapshot = { merchantId, documents: structuredClone(active), updatedAt: new Date().toISOString(),
      version: createHash("sha256").update(JSON.stringify(active)).digest("hex") };
    this.snapshots.delete(merchantId); this.snapshots.set(merchantId, snapshot);
    while (this.snapshots.size > this.maxMerchants) this.snapshots.delete(this.snapshots.keys().next().value!);
    return snapshot;
  }
  getSnapshot(merchantId: string): KnowledgeSnapshot | undefined {
    const snapshot = this.snapshots.get(merchantId);
    return snapshot ? structuredClone(snapshot) : undefined;
  }
  getDocuments(merchantId: string): VectorDocumentForAi[] { return this.getSnapshot(merchantId)?.documents ?? []; }
  delete(merchantId: string): boolean { return this.snapshots.delete(merchantId); }
}
