import type { AiContextForRequest } from "../../types/ai-contract.types";
export interface KnowledgeBackend {
  version(merchantId: string): Promise<string>;
  snapshot(merchantId: string): Promise<AiContextForRequest>;
  query(merchantId: string, sql: string): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }>;
}
export class HttpKnowledgeBackend implements KnowledgeBackend {
  private readonly base = (process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.base}/internal/ai/${path}`, {
      method: body ? "POST" : "GET", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN || "dev_internal_service_token"}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`KNOWLEDGE_BACKEND_${response.status}`);
    return await response.json() as T;
  }
  async version(merchantId: string): Promise<string> {
    return (await this.request<{ version: string }>(`knowledge-version?merchant_id=${encodeURIComponent(merchantId)}`)).version;
  }
  snapshot(merchantId: string): Promise<AiContextForRequest> {
    return this.request(`knowledge-snapshot?merchant_id=${encodeURIComponent(merchantId)}`);
  }
  query(merchantId: string, sql: string): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
    return this.request("query", { merchant_id: merchantId, sql });
  }
}
