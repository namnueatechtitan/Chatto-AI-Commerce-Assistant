import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EmbeddingsService } from "../../modules/embeddings";
import { OllamaClient } from "../../modules/llm/ollama-client";
import { RagService } from "../../modules/rag";
import { HttpKnowledgeBackend } from "../../modules/qa/backend";
import { QaEngine, type QaAnswer } from "../../modules/qa/engine";
import { qaCases, merchantId, type QaCase, type ExperimentMode, type RetrievalMode, type FixtureState } from "./dataset";
import { gradeAnswer, retrievalMetrics, percentile, shuffled, type ExactFactGrade } from "./grading";

interface SeedController { seed(): Promise<unknown>; setState(state: FixtureState): Promise<void>; isolatedUrl(): string }
interface AnswerObservation {
  id: string; case_id: string; split: string; category: string; language: string; repeat: number;
  mode: ExperimentMode; state: FixtureState; started_at_utc: string; finished_at_utc: string;
  status: "success" | "error"; client_wall_ms: number; question: string; history: QaCase["history"];
  gold: Pick<QaCase, "expectedDecision" | "expectedAnswer" | "facts" | "requiredSourceIds" | "forbiddenPatterns">;
  input_sha256: string; response_sha256?: string; answer?: QaAnswer; grade?: ExactFactGrade; error?: string;
}
interface RetrievalObservation {
  id: string; case_id: string; split: string; language: string; category: string; repeat: number; mode: RetrievalMode;
  started_at_utc: string; status: "success" | "error"; wall_ms: number; query: string; gold_ids: string[];
  ranked_ids?: string[]; chunks?: unknown; recall_at_3?: number; recall_at_5?: number; reciprocal_rank_at_5?: number; error?: string;
}
const hash = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const mean = (values: number[]): number | null => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
// Logical abstentions are completed decisions. Invalid model output and backend failures cannot earn safety passes.
export function isPipelineFailure(answer: QaAnswer): boolean {
  const completedReasons = new Set(["AMBIGUOUS_QUESTION", "NO_EVIDENCE", "MISSING_REQUIRED_FACTS", "EMPTY_SUPPORTED_ANSWER",
    "PROMPT_INJECTION", "SENSITIVE_CREDENTIAL", "COMMERCE_ACTION_OUT_OF_SCOPE", "CUSTOMER_REQUESTED_HUMAN", "HUMAN_REQUEST",
    "EMPTY_INPUT", "UNSAFE_HISTORY", "CONTEXT_FREE_GREETING"]);
  return Boolean(answer.reason && !completedReasons.has(answer.reason));
}
function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name); return index < 0 ? fallback : process.argv[index + 1] || fallback;
}
function countArgument(name: string, fallback: number, maximum: number): number {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be an integer in 1..${maximum}`);
  return value;
}
function gitMetadata(): { commit: string; dirty: boolean } {
  try {
    return { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      dirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) };
  } catch { return { commit: "unavailable", dirty: true }; }
}
export async function localModelMetadata(ollama: OllamaClient, embedding: EmbeddingsService): Promise<unknown> {
  const base = new URL(ollama.baseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Experiment inference requires a localhost Ollama endpoint");
  if (embedding.getProvider() !== "ollama") throw new Error("This experiment requires explicit local Ollama embeddings");
  const get = async (suffix: string): Promise<unknown> => {
    const response = await fetch(`${ollama.baseUrl}${suffix}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Ollama metadata unavailable (${response.status})`); return response.json();
  };
  const [version, tags] = await Promise.all([get("/api/version"), get("/api/tags")]);
  const models = (tags as { models?: Array<{ name: string; digest: string; size: number; details?: unknown }> }).models ?? [];
  const selected = [ollama.model, embedding.getModel()].map(name => {
    const found = models.find(model => model.name === name || model.name === `${name}:latest`);
    if (!found) throw new Error(`Required local model is not installed: ${name}`);
    return found;
  });
  let gpu: string | null = null;
  try { gpu = execFileSync("nvidia-smi", ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"], { encoding: "utf8" }).trim(); } catch { /* No GPU telemetry is reported as unavailable. */ }
  return { version, selected_models: selected, gpu, platform: os.platform(), release: os.release(),
    cpu: os.cpus()[0]?.model ?? "unavailable", logical_cpus: os.cpus().length, total_ram_bytes: os.totalmem(), node: process.version };
}

/** Explicit implementation files only: credentials and environment files are never scanned. */
export async function captureCodeManifest(repositoryRoot = path.resolve(__dirname, "../../../../..")) {
  const sourcePaths = [
    "apps/ai-service/src/modules/qa/engine.ts", "apps/ai-service/src/modules/qa/backend.ts",
    "apps/ai-service/src/modules/qa/grounding.ts", "apps/ai-service/src/modules/qa/customer-renderer.ts",
    "apps/ai-service/src/modules/qa/fallback.ts",
    "apps/ai-service/src/modules/llm/ollama-client.ts",
    "apps/ai-service/src/modules/embeddings/index.ts", "apps/ai-service/src/modules/guardrails/index.ts",
    "apps/ai-service/src/modules/mcp/context.ts", "apps/ai-service/src/modules/rag/index.ts",
    "apps/ai-service/src/modules/rag/vector-document.builder.ts", "apps/ai-service/src/modules/rag/document-chunker.ts",
    "apps/ai-service/src/modules/retrieval/index.ts", "apps/ai-service/src/modules/retrieval/bm25.ts",
    "apps/ai-service/src/modules/retrieval/knowledge-index.ts",
    "apps/api/src/modules/internal-ai/readonly-query.compiler.ts", "apps/api/src/modules/internal-ai/readonly-query.service.ts",
    "apps/api/src/modules/internal-ai/internal-ai.service.ts", "apps/api/src/modules/internal-ai/internal-ai.controller.ts",
    "apps/ai-service/src/experiments/qa/dataset.ts", "apps/ai-service/src/experiments/qa/grading.ts",
    "apps/ai-service/src/experiments/qa/run.ts", "apps/ai-service/src/experiments/qa/load.ts",
  ].sort();
  const requested = [
    ...sourcePaths.flatMap(file => [{ path: file, kind: "source" },
      { path: file.replace("/src/", "/dist/").replace(/\.ts$/u, ".js"), kind: "compiled_runtime" }]),
    { path: "apps/api/prisma/schema.prisma", kind: "database_schema" },
    { path: "apps/api/prisma/migrations/20261003133000_static_knowledge_revision/migration.sql", kind: "database_migration" },
    { path: "apps/ai-service/scripts/qa-seed.cjs", kind: "fixture_source" },
    ...["package.json", "pnpm-lock.yaml", "apps/ai-service/package.json", "apps/api/package.json"].map(file => ({path:file,kind:"dependency_manifest"})),
  ];
  const files = await Promise.all(requested.map(async file => {
    try {
      const bytes = await fs.readFile(path.join(repositoryRoot, file.path));
      return { ...file, status: "present", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    } catch (error) {
      if (file.kind !== "compiled_runtime" || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { ...file, status: "missing", bytes: null, sha256: null };
    }
  }));
  return { captured_at_utc: new Date().toISOString(), sha256: hash(files), files,
    note: "SHA-256 of explicit implementation sources and built JavaScript. Missing runtime files are disclosed. This is provenance, not a claim that code has been committed or independently audited." };
}

export function summarizeAnswers(rows: AnswerObservation[]) {
  return Object.fromEntries((["hybrid", "sql", "combined"] as const).map(mode => {
    const attempts = rows.filter(row => row.mode === mode);
    const success = attempts.filter(row => row.status === "success" && row.grade);
    const answerable = attempts.filter(row => row.gold.expectedDecision === "answer");
    const answers = success.filter(row => row.grade!.answered);
    const latency = success.map(row => row.client_wall_ms);
    return [mode, {
      attempts: attempts.length, completed: success.length, errors: attempts.length - success.length,
      expected_answerable: answerable.length, answered_answerable: answerable.filter(row => row.status === "success" && row.grade?.answered).length,
      answer_coverage: answerable.length ? answerable.filter(row => row.status === "success" && row.grade?.answered).length / answerable.length : null,
      exact_fact_pass_all_answerable: answerable.length ? answerable.filter(row => row.status === "success" && row.grade?.exact_fact_pass === true).length / answerable.length : null,
      task_check_pass_all_attempts: attempts.length ? success.filter(row => row.grade!.task_check_pass).length / attempts.length : null,
      decision_correct_all_attempts: attempts.length ? success.filter(row => row.grade!.decision_correct).length / attempts.length : null,
      unbound_claim_count: success.reduce((sum, row) => sum + row.grade!.unbound_claim_count, 0),
      attempted_claims_checked: attempts.reduce((sum, row) => sum + (row.grade?.attempted_claims_checked || 0), 0),
      raw_unbound_selection_claim_count: attempts.reduce((sum, row) => sum + (row.grade?.raw_unbound_selection_claim_count || 0), 0),
      source_binding_pass_answered: answers.length ? answers.filter(row => row.grade!.source_binding_pass).length / answers.length : null,
      mean_attempt_wall_ms: mean(attempts.map(row => row.client_wall_ms)), p95_attempt_wall_ms: percentile(attempts.map(row => row.client_wall_ms), 0.95),
      mean_client_wall_ms: mean(latency), median_client_wall_ms: percentile(latency, 0.5), p95_client_wall_ms: percentile(latency, 0.95),
      mean_prompt_tokens: mean(success.map(row => row.answer!.usage.prompt_tokens)),
      mean_completion_tokens: mean(success.map(row => row.answer!.usage.completion_tokens)),
      mean_plan_ms: mean(success.map(row => row.answer!.timings.plan_ms)),
      mean_retrieval_ms: mean(success.map(row => row.answer!.timings.retrieval_ms)),
      mean_sql_ms: mean(success.map(row => row.answer!.timings.sql_ms)),
      mean_generation_ms: mean(success.map(row => row.answer!.timings.generation_ms)),
      independent_cases: new Set(attempts.map(row => row.case_id)).size,
    }];
  }));
}

export function summarizeRetrieval(observations: RetrievalObservation[]) {
  return Object.fromEntries((["dense", "bm25", "hybrid", "hybrid_rerank"] as const).map(mode => {
    const attempts = observations.filter(row => row.mode === mode);
    const rows = attempts.filter(row => row.status === "success");
    const allAttemptMean = (metric: "recall_at_3" | "recall_at_5" | "reciprocal_rank_at_5") =>
      mean(attempts.map(row => row.status === "success" ? row[metric]! : 0));
    return [mode, { attempts: attempts.length, completed: rows.length, errors: attempts.length - rows.length,
      independent_queries: new Set(attempts.map(row => row.case_id)).size,
      mean_recall_at_3: mean(rows.map(row => row.recall_at_3!)), mean_recall_at_5: mean(rows.map(row => row.recall_at_5!)),
      mean_reciprocal_rank_at_5: mean(rows.map(row => row.reciprocal_rank_at_5!)),
      mean_recall_at_3_all_attempts: allAttemptMean("recall_at_3"), mean_recall_at_5_all_attempts: allAttemptMean("recall_at_5"),
      mean_reciprocal_rank_at_5_all_attempts: allAttemptMean("reciprocal_rank_at_5"),
      mean_attempt_wall_ms: mean(attempts.map(row => row.wall_ms)), p95_attempt_wall_ms: percentile(attempts.map(row => row.wall_ms), 0.95),
      mean_wall_ms: mean(rows.map(row => row.wall_ms)), p95_wall_ms: percentile(rows.map(row => row.wall_ms), 0.95) }];
  }));
}

async function main(): Promise<void> {
  const seedController = require(path.resolve(__dirname, "../../../scripts/qa-seed.cjs")) as SeedController;
  // Refuse ordinary/live database URLs before any inference or fixture mutation.
  seedController.isolatedUrl();
  const repeats = countArgument("--repeats", 2, 10);
  const retrievalRepeats = countArgument("--retrieval-repeats", 3, 10);
  const seed = countArgument("--seed", 20261003, 2147483647);
  const split = argument("--split", "test");
  if (!["test", "dev"].includes(split)) throw new Error("--split must be dev or test; runs never mix development and test results");
  const phase = argument("--phase", split === "dev" ? "development" : "first-frozen-test");
  if (!["development", "first-frozen-test", "post-debug-validation"].includes(phase)) throw new Error("--phase must identify development, first-frozen-test or post-debug-validation");
  const limit = countArgument("--limit", 1000, 1000);
  const selected = qaCases.filter(test => test.split === split).slice(0, limit);
  if (!selected.length) throw new Error("No cases selected");
  const out = path.resolve(argument("--out", "outputs/qa-architecture-experiment-20261003"));
  await fs.mkdir(out, { recursive: true });
  const journalPath = path.join(out, "answers.ndjson");
  // Never overwrite an existing experiment's raw measurements.
  await fs.writeFile(journalPath, "", { flag: "wx" });
  if (process.argv.includes("--seed-db")) await seedController.seed();
  await seedController.setState("baseline");
  const backend = new HttpKnowledgeBackend();
  const ollama = new OllamaClient(); const embeddings = new EmbeddingsService(); const rag = new RagService();
  const engine = new QaEngine({ backend, ollama, embeddings, rag });
  const codeManifest = await captureCodeManifest();
  await fs.writeFile(path.join(out, "code-manifest.json"), JSON.stringify(codeManifest, null, 2));
  const environment = await localModelMetadata(ollama, embeddings);
  const initialSnapshot = await backend.snapshot(merchantId);
  if (initialSnapshot.products?.products.length !== 8 || initialSnapshot.knowledge_base?.knowledge_base.length !== 6) throw new Error("Isolated backend must expose the seeded 8-product, 6-document primary merchant");
  const metadata = {
    experiment_id: `qa-${new Date().toISOString().replace(/[:.]/g, "-")}`, started_at_utc: new Date().toISOString(), split, evaluation_phase: phase,
    cases: selected.length, repetitions: repeats, retrieval_repetitions: retrievalRepeats, seed,
    modes: ["hybrid", "sql", "combined"], retrieval_modes: ["dense", "bm25", "hybrid", "hybrid_rerank"],
    dataset_sha256: hash(qaCases), selected_cases_sha256: hash(selected), corpus_sha256: hash(initialSnapshot),
    code_manifest_sha256: codeManifest.sha256, code_manifest_captured_at_utc: codeManifest.captured_at_utc, git: gitMetadata(), environment,
    controls: { temperature: 0, model_seed: 42, context_tokens: 8192, output_tokens: 700, thinking: false, stream: false },
    protocol: "Same installed Qwen model and isolated PostgreSQL records across modes; case order and paired mode order shuffled with fixed seed. Each case's DB state is identical across its paired modes. Warm-ups excluded. Historical workbook results are not reused or relabelled.",
    interpretation: "Hybrid means semantic/BM25 retrieval with a fixed validated catalog lookup for current structured fields. SQL means natural-language SELECT over scoped catalog/knowledge. Combined plans SQL, RAG or both. Exact fact screening and quote binding are not human accuracy or hallucination scores.",
    dataset_partition: phase === "post-debug-validation"
      ? "The same 36 test questions are rerun after reviewing first-run failures and changing general prompts/guards. Gold is unchanged. This is post-debug validation, not an independent held-out estimate; a fresh future challenge set is required."
      : "Six development examples and 36 test questions are separately declared. Only the chosen split is scored. Prompts and gold are frozen before the first test run; no automatic test-driven tuning is performed.",
  };
  await fs.writeFile(path.join(out, "metadata.json"), JSON.stringify(metadata, null, 2));
  await fs.writeFile(path.join(out, "dataset.json"), JSON.stringify(selected, null, 2));
  const preparedStarted = performance.now();
  const prepared = await engine.prepare(merchantId);
  await fs.writeFile(path.join(out, "cold-preparation.json"), JSON.stringify({ wall_ms: performance.now() - preparedStarted, document_count: prepared.length,
    embedding_identity: embeddings.getIdentity(), vector_dimensions: embeddings.getDimensions(), snapshot_version: await backend.version(merchantId) }, null, 2));
  const warmups: unknown[] = [];
  for (const mode of ["hybrid", "sql", "combined"] as const) {
    const test = qaCases.find(item => item.id === "D01")!;
    const result = await engine.answer({ merchantId, conversationId: `qa-warmup-${mode}`, message: test.message, mode, language: test.language });
    warmups.push({ mode, case_id: test.id, result });
    if (isPipelineFailure(result) || result.timings.plan_ms === 0) throw new Error(`Planning warm-up failed for ${mode}: ${result.reason || "no model timing"}`);
  }
  await fs.writeFile(path.join(out, "warmups.json"), JSON.stringify(warmups, null, 2));
  const answers: AnswerObservation[] = [];
  const retrievalRows: RetrievalObservation[] = [];
  const retrievalPath = path.join(out, "retrieval.ndjson"); await fs.writeFile(retrievalPath, "", { flag: "wx" });
  try {
    for (let repeat = 1; repeat <= repeats; repeat++) {
      for (const test of shuffled(selected, seed + repeat)) {
        await seedController.setState(test.state);
        for (const mode of shuffled<ExperimentMode>(["hybrid", "sql", "combined"], seed + repeat * 1000 + Number(test.id.slice(1)))) {
          const started = performance.now();
          const row: AnswerObservation = {
            id: `${split}:${test.id}:r${repeat}:${mode}`, case_id: test.id, split, category: test.category, language: test.language,
            repeat, mode, state: test.state, started_at_utc: new Date().toISOString(), finished_at_utc: "", status: "error", client_wall_ms: 0,
            question: test.message, history: test.history,
            gold: { expectedDecision: test.expectedDecision, expectedAnswer: test.expectedAnswer, facts: test.facts, requiredSourceIds: test.requiredSourceIds, forbiddenPatterns: test.forbiddenPatterns },
            input_sha256: hash({ merchantId, question: test.message, history: test.history, language: test.language, state: test.state }),
          };
          try {
            const result = await engine.answer({ merchantId, conversationId: `qa-${test.id}-r${repeat}-${mode}`, message: test.message,
              history: test.history, mode, language: test.language });
            row.answer = result; row.grade = gradeAnswer(test, result); row.response_sha256 = hash(result.text);
            row.status = isPipelineFailure(result) ? "error" : "success";
            if (row.status === "error") row.error = result.reason || "QA_FAILURE";
          } catch (error) { row.error = error instanceof Error ? error.message : String(error); }
          row.client_wall_ms = performance.now() - started; row.finished_at_utc = new Date().toISOString();
          answers.push(row); await fs.appendFile(journalPath, `${JSON.stringify(row)}\n`);
          console.log(`${row.id}: ${row.status}, ${row.answer?.decision ?? "error"}, ${Math.round(row.client_wall_ms)} ms`);
        }
      }
    }
    await seedController.setState("baseline");
    const eligible = selected.filter(test => test.retrievalEligible && test.requiredSourceIds.length > 0 && test.state === "baseline");
    for (let repeat = 1; repeat <= retrievalRepeats; repeat++) {
      for (const test of shuffled(eligible, seed + 10000 + repeat)) {
        for (const mode of shuffled<RetrievalMode>(["dense", "bm25", "hybrid", "hybrid_rerank"], seed + 20000 + repeat * 1000 + Number(test.id.slice(1)))) {
          const started = performance.now();
          const row: RetrievalObservation = { id: `${split}:${test.id}:r${repeat}:${mode}`, case_id: test.id, split, category: test.category,
            language: test.language, repeat, mode, started_at_utc: new Date().toISOString(), status: "error", wall_ms: 0,
            query: test.message, gold_ids: test.requiredSourceIds };
          try {
            const result = await engine.retrieveOnly(merchantId, test.message, mode);
            row.ranked_ids = result.chunks.map(chunk => chunk.source_id); row.chunks = result.chunks;
            Object.assign(row, retrievalMetrics(test.requiredSourceIds, row.ranked_ids)); row.status = "success";
          } catch (error) { row.error = error instanceof Error ? error.message : String(error); }
          row.wall_ms = performance.now() - started; retrievalRows.push(row); await fs.appendFile(retrievalPath, `${JSON.stringify(row)}\n`);
        }
      }
    }
  } finally { await seedController.setState("baseline"); }
  const retrievalSummary = summarizeRetrieval(retrievalRows);
  const results = { metadata: { ...metadata, finished_at_utc: new Date().toISOString() }, summary: summarizeAnswers(answers), retrieval_summary: retrievalSummary,
    answers, retrieval: retrievalRows, human_ratings: "Not performed. Human accuracy, Thai naturalness and hallucination ratings are intentionally blank." };
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify(results, null, 2));
  if (answers.some(row => row.status === "error") || retrievalRows.some(row => row.status === "error")) process.exitCode = 2;
  console.log(`Saved ${answers.length} end-to-end and ${retrievalRows.length} retrieval-only observations to ${out}`);
}

if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
