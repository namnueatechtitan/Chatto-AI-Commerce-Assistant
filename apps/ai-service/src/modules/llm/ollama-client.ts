export interface ModelMetrics { wall_ms: number; prompt_tokens: number; completion_tokens: number; load_ms: number; eval_ms: number }
export class OllamaClient {
  readonly model = process.env.OLLAMA_MODEL || "qwen3.5:9b";
  readonly baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  async generateJson<T>(system: string, user: string, schema?: Record<string, unknown>): Promise<{ value: T; metrics: ModelMetrics }> {
    const started = performance.now();
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST", signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS || 60000)),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, stream: false, think: false, format: schema || "json", keep_alive: "30m",
        options: { temperature: 0, seed: 42, num_ctx: 8192, num_predict: 700 },
        messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    if (!response.ok) throw new Error(`OLLAMA_HTTP_${response.status}`);
    const body = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number; load_duration?: number; eval_duration?: number; done_reason?: string };
    if (body.done_reason === "length") throw new Error("MODEL_OUTPUT_TRUNCATED");
    return { value: JSON.parse(body.message?.content || "") as T, metrics: {
      wall_ms: performance.now() - started, prompt_tokens: body.prompt_eval_count || 0,
      completion_tokens: body.eval_count || 0, load_ms: (body.load_duration || 0) / 1e6, eval_ms: (body.eval_duration || 0) / 1e6,
    } };
  }
}
