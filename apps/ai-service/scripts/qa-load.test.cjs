const test = require("node:test");
const assert = require("node:assert/strict");
const { boundedBatches, loadCases, parseGpuCsv, summarizeLoad } = require("../dist/experiments/qa/load");
const { captureCodeManifest } = require("../dist/experiments/qa/run");

test("load question order is reproducible and contains exactly four of each development case", () => {
  const cases = loadCases(20261003);
  assert.equal(cases.length, 12);
  assert.deepEqual(cases.map(item => item.id), loadCases(20261003).map(item => item.id));
  for (const id of ["D01", "D02", "D03"]) assert.equal(cases.filter(item => item.id === id).length, 4);
  assert.ok(cases.every(item => item.split === "dev" && item.state === "baseline"));
});

test("bounded execution runs each request once, preserves order and never exceeds its concurrency limit", async () => {
  let active = 0; let peak = 0; const seen = [];
  const result = await boundedBatches([0, 1, 2, 3, 4], 2, async (item, index, batch) => {
    active++; peak = Math.max(active, peak); seen.push({ item, index, batch });
    await new Promise(resolve => setImmediate(resolve)); active--;
    return item * 10;
  });
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.deepEqual(result, [0, 10, 20, 30, 40]);
  assert.deepEqual(seen.map(item => item.batch), [1, 1, 2, 2, 3]);
  await assert.rejects(boundedBatches([], 0, async item => item), /positive integer/);
});

test("load latency includes failures, throughput counts completed responses and tokens are not estimated", () => {
  const rows = [
    { case_id: "D01", status: "success", wall_ms: 100, rss_after_bytes: 1000, answer: { decision: "answer", usage: { prompt_tokens: 20, completion_tokens: 10 } }, grade: { exact_fact_pass: true } },
    { case_id: "D02", status: "error", wall_ms: 300, rss_after_bytes: 2000 },
  ];
  const result = summarizeLoad(rows, 1000);
  assert.equal(result.completed, 1);
  assert.equal(result.errors, 1);
  assert.equal(result.throughput_completed_per_second, 1);
  assert.equal(result.throughput_attempts_per_second, 2);
  assert.equal(result.mean_wall_ms, 200);
  assert.equal(result.p50_wall_ms, 200);
  assert.equal(result.p95_wall_ms, 290);
  assert.equal(result.exact_fact_pass_all_attempts, 0.5);
  assert.equal(result.reported_prompt_tokens, 20);
  assert.equal(result.requests_with_reported_usage, 1);
  assert.equal(result.peak_rss_after_request_bytes, 2000);
});

test("GPU telemetry parses numeric observations and never treats unsupported fields as real peaks", () => {
  assert.deepEqual(parseGpuCsv("0, NVIDIA GeForce RTX 5090, 19000, 32607, 95, 67\n"),
    [{ index: 0, name: "NVIDIA GeForce RTX 5090", memory_used_mib: 19000, memory_total_mib: 32607, utilization_percent: 95, temperature_c: 67 }]);
  assert.throws(() => parseGpuCsv("0, GPU, N/A, 32000, N/A, 67"), /unavailable/);
  assert.deepEqual(parseGpuCsv(""), []);
});

test("implementation manifest hashes explicit source and runtime files without scanning environment files", async () => {
  const manifest = await captureCodeManifest();
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.ok(manifest.files.some(file => file.path.endsWith("readonly-query.compiler.ts") && file.status === "present"));
  assert.ok(manifest.files.some(file => file.path.endsWith("modules/qa/engine.ts") && file.status === "present"));
  assert.ok(manifest.files.some(file => file.path.endsWith("modules/rag/index.ts") && file.status === "present"));
  assert.ok(manifest.files.every(file => !file.path.includes(".env")));
  assert.ok(manifest.files.filter(file => file.status === "present").every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.equal(manifest.sha256, (await captureCodeManifest()).sha256);
});
