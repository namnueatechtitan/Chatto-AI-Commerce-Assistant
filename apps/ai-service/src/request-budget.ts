import { performance } from "node:perf_hooks";

export type CancellationCategory = "timeout" | "deadline_exceeded" | "cancelled";
export interface RequestControl { signal?: AbortSignal; timeoutMs?: number }
export type StageName = "document_embedding" | "query_embedding" | "vector_sync" | "retrieval" | "generation";
export type StageOutcome = "completed" | "skipped" | "timed_out" | "cancelled" | "failed";

export function cancellationCategory(signal?: AbortSignal): CancellationCategory {
  return signal?.reason === "deadline_exceeded" ? "deadline_exceeded"
    : signal?.reason === "timeout" ? "timeout" : "cancelled";
}

/** Every caller owns and disposes its operation timer and abort listener. */
export function operationControl(timeoutMs: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(cancellationCategory(parent));
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  const timer = timeoutMs > 0 && Number.isFinite(timeoutMs)
    ? setTimeout(() => controller.abort("timeout"), timeoutMs) : undefined;
  if (!timer) controller.abort("deadline_exceeded");
  return { signal: controller.signal, dispose: () => {
    if (timer) clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  } };
}

export class RequestBudget {
  private readonly startedAt = performance.now();
  private readonly controller = new AbortController();
  private readonly durationMs: number;
  private readonly timer: NodeJS.Timeout;
  readonly stages: Partial<Record<StageName, { latency_ms: number; outcome: StageOutcome }>> = {};
  constructor(deadlineAtMs?: number) {
    // Leave at least 1s outside the AI service for transport and API handling.
    this.durationMs = Math.max(0, Math.min(19000,
      deadlineAtMs === undefined ? 19000 : deadlineAtMs - Date.now()));
    this.timer = setTimeout(() => this.controller.abort("deadline_exceeded"), this.durationMs);
    if (this.durationMs === 0) this.controller.abort("deadline_exceeded");
  }
  get signal(): AbortSignal { return this.controller.signal; }
  remainingMs(): number {
    return this.signal.aborted ? 0 : Math.max(0, this.durationMs - (performance.now() - this.startedAt));
  }
  preprocessingMs(capMs: number): number {
    // All optional network preparation shares 3s; protect the 15s generation budget.
    return Math.max(0, Math.min(capMs, 3000 - (performance.now() - this.startedAt), this.remainingMs() - 15000));
  }
  generationMs(): number { return Math.max(0, Math.min(15000, this.remainingMs() - 500)); }
  record(name: StageName, startedAt: number, outcome: StageOutcome): void {
    this.stages[name] = { latency_ms: Math.max(0, Math.round(performance.now() - startedAt)), outcome };
  }
  elapsedMs(): number { return Math.max(0, Math.round(performance.now() - this.startedAt)); }
  cancel(): void { this.controller.abort("cancelled"); }
  dispose(): void { clearTimeout(this.timer); }
}
