import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { EmbeddingsService } from "../../modules/embeddings";
import { OllamaClient } from "../../modules/llm/ollama-client";
import { HttpKnowledgeBackend } from "../../modules/qa/backend";
import { QaEngine, type QaAnswer } from "../../modules/qa/engine";
import { RagService } from "../../modules/rag";
import { fixtureId, merchantId, qaCases, type QaCase } from "./dataset";
import { gradeAnswer, percentile, shuffled, type ExactFactGrade } from "./grading";
import { captureCodeManifest, isPipelineFailure, localModelMetadata } from "./run";

const execFileAsync = promisify(execFile);
export interface LoadObservation {
  id: string; case_id: string; conversation_id: string; concurrency: number; sequence: number; batch: number;
  started_at_utc: string; finished_at_utc: string; status: "success" | "error"; wall_ms: number;
  question: string; answer?: QaAnswer; grade?: ExactFactGrade; error?: string; rss_after_bytes: number;
}
export interface GpuReading { index: number; name: string; memory_used_mib: number; memory_total_mib: number; utilization_percent: number; temperature_c: number }
interface TelemetrySample { phase: string; started_at_utc: string; finished_at_utc: string; rss_bytes: number; gpus: GpuReading[] | null; error?: string }
const mean = (values: number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function loadCases(seed: number): QaCase[] {
  const questions = ["D01", "D02", "D03"].map(id => {
    const item = qaCases.find(test => test.id === id && test.split === "dev");
    if (!item) throw new Error(`Missing frozen development example ${id}`); return item;
  });
  return shuffled(Array.from({ length: 12 }, (_, index) => questions[index % questions.length]), seed);
}

/** A closed finite workload in bounded batches; there is no unbounded arrival queue. */
export async function boundedBatches<T, R>(items: T[], concurrency: number, run: (item: T, index: number, batch: number) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concurrency must be a positive integer");
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += concurrency) {
    results.push(...await Promise.all(items.slice(offset, offset + concurrency)
      .map((item, index) => run(item, offset + index, Math.floor(offset / concurrency) + 1))));
  }
  return results;
}

export function summarizeLoad(rows: LoadObservation[], windowMs: number) {
  const completed = rows.filter(row => row.status === "success");
  const latencies = rows.map(row => row.wall_ms);
  const reportedUsage = rows.flatMap(row => row.answer ? [row.answer.usage] : []);
  return { attempts: rows.length, completed: completed.length, errors: rows.length - completed.length,
    answered: completed.filter(row => row.answer?.decision === "answer").length,
    exact_fact_pass_all_attempts: rows.length ? rows.filter(row => row.status === "success" && row.grade?.exact_fact_pass === true).length / rows.length : null,
    window_ms: windowMs, throughput_completed_per_second: windowMs > 0 ? completed.length * 1000 / windowMs : null,
    throughput_attempts_per_second: windowMs > 0 ? rows.length * 1000 / windowMs : null,
    mean_wall_ms: mean(latencies), p50_wall_ms: percentile(latencies, 0.5), p95_wall_ms: percentile(latencies, 0.95),
    reported_prompt_tokens: reportedUsage.reduce((sum, usage) => sum + usage.prompt_tokens, 0),
    reported_completion_tokens: reportedUsage.reduce((sum, usage) => sum + usage.completion_tokens, 0),
    requests_with_reported_usage: reportedUsage.length,
    peak_rss_after_request_bytes: rows.length ? Math.max(...rows.map(row => row.rss_after_bytes)) : null,
    independent_questions: new Set(rows.map(row => row.case_id)).size };
}

export function parseGpuCsv(output: string): GpuReading[] {
  return output.trim().split(/\r?\n/u).filter(Boolean).map(line => {
    const fields = line.split(",").map(field => field.trim());
    const values = [fields[0], fields[2], fields[3], fields[4], fields[5]].map(Number);
    if (fields.length !== 6 || values.some(value => !Number.isFinite(value))) throw new Error("GPU telemetry returned unavailable or unexpected fields");
    return { index: values[0], name: fields[1], memory_used_mib: values[1], memory_total_mib: values[2], utilization_percent: values[3], temperature_c: values[4] };
  });
}

async function gpuReading(): Promise<{ gpus: GpuReading[] | null; error?: string }> {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"],
      { windowsHide: true, timeout: 2500, maxBuffer: 16384 });
    const gpus = parseGpuCsv(stdout);
    return gpus.length ? { gpus } : { gpus: null, error: "No GPU telemetry rows available" };
  } catch { return { gpus: null, error: "nvidia-smi unavailable, timed out, or returned unsupported telemetry" }; }
}

class AsyncTelemetry {
  readonly samples: TelemetrySample[] = [];
  phase = "idle";
  private timer: NodeJS.Timeout | undefined;
  private pending: Promise<void> | undefined;
  async baseline(): Promise<TelemetrySample> {
    const started = new Date().toISOString(); const rss = process.memoryUsage().rss;
    const gpu = await gpuReading();
    return { phase: "baseline", started_at_utc: started, finished_at_utc: new Date().toISOString(), rss_bytes: rss, ...gpu };
  }
  start(): void {
    this.timer = setInterval(() => {
      if (this.pending) return;
      const phase = this.phase; const started = new Date().toISOString(); const rss = process.memoryUsage().rss;
      this.pending = gpuReading().then(gpu => { this.samples.push({ phase, started_at_utc: started, finished_at_utc: new Date().toISOString(), rss_bytes: rss, ...gpu }); })
        .finally(() => { this.pending = undefined; });
    }, 1000);
  }
  async stop(): Promise<void> { if (this.timer) clearInterval(this.timer); await this.pending; }
}

async function main(): Promise<void> {
  // This load runner never seeds, resets or mutates fixture records.
  const fixture = require(path.resolve(__dirname, "../../../scripts/qa-seed.cjs")) as { isolatedUrl(): string };
  fixture.isolatedUrl();
  const base = new URL(process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:4000");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Load experiment requires an isolated localhost backend");
  const outIndex = process.argv.indexOf("--out");
  const out = path.resolve(outIndex >= 0 ? process.argv[outIndex + 1] || "../../outputs/qa-load-20261003" : "../../outputs/qa-load-20261003");
  // Exclusive directory creation refuses all existing results, including partial runs.
  await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
  const backend = new HttpKnowledgeBackend(); const ollama = new OllamaClient(); const embeddings = new EmbeddingsService();
  const engine = new QaEngine({ backend, ollama, embeddings, rag: new RagService() });
  const codeManifest = await captureCodeManifest();
  await fs.writeFile(path.join(out, "code-manifest.json"), JSON.stringify(codeManifest, null, 2));
  const environment = await localModelMetadata(ollama, embeddings);
  const snapshot = await backend.snapshot(merchantId);
  const cloud = snapshot.products?.products.find(product => product.id === fixtureId("product", 1));
  if (snapshot.products?.products.length !== 8 || snapshot.knowledge_base?.knowledge_base.length !== 6
    || cloud?.variants[0]?.available_qty !== 8 || Number(cloud.variants[0]?.price) !== 490) throw new Error("Load runner requires unchanged baseline fixtures; finish the serial test experiment first");
  const version = await backend.version(merchantId); const seed = 20261003;
  const questions = loadCases(seed);
  const metadata = { experiment_id: `qa-load-${new Date().toISOString().replace(/[:.]/gu, "-")}`, started_at_utc: new Date().toISOString(),
    mode: "combined", concurrency_levels: [1, 2, 4], requests_per_level: 12, total_requests: 36, question_ids: ["D01", "D02", "D03"],
    question_order: questions.map(test => test.id), seed, fixture_version: version, environment,
    code_manifest_sha256: codeManifest.sha256, code_manifest_captured_at_utc: codeManifest.captured_at_utc,
    dataset_sha256: createHash("sha256").update(JSON.stringify(qaCases)).digest("hex"),
    controls: { temperature: 0, model_seed: 42, context_tokens: 8192, output_tokens: 700, thinking: false, stream: false,
      intended_ollama_num_parallel: 2, client_process_ollama_num_parallel: process.env.OLLAMA_NUM_PARALLEL || null,
      daemon_parallel_setting_verified_by_api: false },
    protocol: "Three development questions, four requests per question per level. Identical shuffled order at concurrency 1,2,4. Bounded batches with a barrier between batches; no open-loop arrival rate. Separate conversation identifiers; no fixture writes. Warm-up and journal writes excluded from measured windows.",
    cache_note: "Every request invokes full model planning and evidence selection; there is no application answer cache. App document and query-embedding caches are warm. Shared Ollama context/prompt reuse and the local inference queue remain part of measured latency. Models are not unloaded between levels.",
    interpretation: "Finite local queued-inference experiment on this machine, not HTTP ingress or production capacity. RSS measures the Node process hosting QaEngine, not the API or Ollama processes. GPU peaks are 1-second sampled observations, not guaranteed maxima. Ollama daemon parallel setting must be confirmed by its operator; client environment alone does not configure an existing daemon.",
    usage_note: "Reported tokens include phases exposing metrics. Provider or malformed-output errors can consume additional unreported tokens; they are not estimated." };
  await fs.writeFile(path.join(out, "metadata.json"), JSON.stringify(metadata, null, 2));
  const preparationStart = performance.now(); const documents = await engine.prepare(merchantId);
  const warmups: unknown[] = [];
  for (const test of ["D01", "D02", "D03"].map(id => qaCases.find(item => item.id === id)!)) {
    const answer = await engine.answer({ merchantId, conversationId: `qa-load-warmup-${test.id}`, message: test.message, history: test.history,
      language: test.language, mode: "combined" });
    warmups.push({ case_id: test.id, answer });
    if (isPipelineFailure(answer) || answer.timings.plan_ms === 0) throw new Error(`Load warm-up failed: ${test.id} ${answer.reason || "no timing"}`);
  }
  await fs.writeFile(path.join(out, "warmups.json"), JSON.stringify({ preparation_and_warmup_ms: performance.now() - preparationStart,
    document_count: documents.length, warmups }, null, 2));
  const telemetry = new AsyncTelemetry(); const baseline = await telemetry.baseline();
  const observations: LoadObservation[] = []; const levels: unknown[] = [];
  telemetry.start();
  try {
    for (const concurrency of [1, 2, 4]) {
      if (await backend.version(merchantId) !== version) throw new Error("Fixture version changed; concurrent serial experiment would confound load measurements");
      const phase = `concurrency-${concurrency}`; telemetry.phase = phase;
      const rssBefore = process.memoryUsage().rss; const startedAt = new Date().toISOString(); const start = performance.now();
      const rows = await boundedBatches(questions, concurrency, async (test, index, batch): Promise<LoadObservation> => {
        const requestStart = performance.now(); const conversationId = `qa-load-c${concurrency}-request-${index + 1}`;
        const row: LoadObservation = { id: conversationId, conversation_id: conversationId, case_id: test.id, concurrency,
          sequence: index + 1, batch, started_at_utc: new Date().toISOString(), finished_at_utc: "", status: "error", wall_ms: 0,
          question: test.message, rss_after_bytes: 0 };
        try {
          row.answer = await engine.answer({ merchantId, conversationId, message: test.message, history: test.history, language: test.language, mode: "combined" });
          row.grade = gradeAnswer(test, row.answer); row.status = isPipelineFailure(row.answer) ? "error" : "success";
          if (row.status === "error") row.error = row.answer.reason || "QA_FAILURE";
        } catch (error) { row.error = error instanceof Error ? error.message : String(error); }
        row.wall_ms = performance.now() - requestStart; row.finished_at_utc = new Date().toISOString(); row.rss_after_bytes = process.memoryUsage().rss;
        return row;
      });
      const windowMs = performance.now() - start; const finishedAt = new Date().toISOString(); const rssAfter = process.memoryUsage().rss;
      telemetry.phase = "between-levels";
      const versionAfter = await backend.version(merchantId);
      const summary = { concurrency, started_at_utc: startedAt, finished_at_utc: finishedAt, ...summarizeLoad(rows, windowMs),
        rss_before_bytes: rssBefore, rss_after_bytes: rssAfter, fixture_version_unchanged: versionAfter === version };
      observations.push(...rows); levels.push(summary);
      await fs.appendFile(path.join(out, "requests.ndjson"), rows.map(row => JSON.stringify(row)).join("\n") + "\n");
      await fs.writeFile(path.join(out, `concurrency-${concurrency}.json`), JSON.stringify({ summary, requests: rows }, null, 2));
      console.log(`Load concurrency ${concurrency}: ${summary.completed}/${summary.attempts} completed, ${summary.p95_wall_ms?.toFixed(0)} ms P95, ${summary.throughput_completed_per_second?.toFixed(2)} completed/s`);
      if (versionAfter !== version) throw new Error("Fixture version changed during measured window; results are confounded");
    }
  } finally { await telemetry.stop(); await fs.writeFile(path.join(out, "telemetry.json"), JSON.stringify({ baseline, samples: telemetry.samples }, null, 2)); }
  const sampledLevels = levels.map(level => {
    const row = level as { concurrency: number; rss_before_bytes: number; rss_after_bytes: number };
    const samples = telemetry.samples.filter(sample => sample.phase === `concurrency-${row.concurrency}`);
    const observedGpus = samples.flatMap(sample => sample.gpus || []);
    const gpuPeaks = [...new Set(observedGpus.map(gpu => gpu.index))].map(index => {
      const readings = observedGpus.filter(gpu => gpu.index === index);
      return { index, name: readings[0].name, sampled_peak_memory_used_mib: Math.max(...readings.map(gpu => gpu.memory_used_mib)),
        sampled_peak_utilization_percent: Math.max(...readings.map(gpu => gpu.utilization_percent)), samples: readings.length };
    });
    return { ...row, sampled_rss_peak_bytes: Math.max(row.rss_before_bytes, row.rss_after_bytes, ...samples.map(sample => sample.rss_bytes)),
      gpu_peaks: gpuPeaks.length ? gpuPeaks : null, telemetry_samples: samples.length,
      gpu_peak_available: gpuPeaks.length > 0, gpu_peak_note: gpuPeaks.length ? "1-second sampled peak; shorter spikes may be missed" : "No valid GPU peak samples available; no peak was inferred" };
  });
  const results = { metadata: { ...metadata, finished_at_utc: new Date().toISOString() }, summary: sampledLevels,
    requests: observations, telemetry: { baseline, samples: telemetry.samples }, human_ratings: "Not performed; this measures local finite-workload behavior." };
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify(results, null, 2));
  if (observations.some(row => row.status === "error")) process.exitCode = 2;
  console.log(`Saved ${observations.length} load observations to ${out}`);
}

if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
