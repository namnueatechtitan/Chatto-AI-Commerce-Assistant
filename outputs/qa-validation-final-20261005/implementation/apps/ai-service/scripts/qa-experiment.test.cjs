const test = require("node:test");
const assert = require("node:assert/strict");
const { qaCases, fixtureId, merchantId } = require("../dist/experiments/qa/dataset");
const { gradeAnswer, retrievalMetrics, percentile, shuffled } = require("../dist/experiments/qa/grading");
const { summarizeAnswers, summarizeRetrieval, isPipelineFailure, captureCodeManifest } = require("../dist/experiments/qa/run");
const seed = require("./qa-seed.cjs");

function answer(overrides = {}) {
  const verified = "Cloud Oversized Shirt white size M. Price: 490 THB";
  return { text: verified, decision: "answer", route: "sql", sources: [{ id: "sql:0", type: "product", title: "Cloud", text: verified }],
    selectedClaims: [{ source_id: "sql:0", quote: verified }], retrievedIds: [fixtureId("product", 1)],
    timings: { plan_ms: 1, retrieval_ms: 0, sql_ms: 2, generation_ms: 3, total_ms: 6 }, usage: { prompt_tokens: 20, completion_tokens: 10 }, ...overrides };
}

test("held-out dataset has 36 unique test questions, disjoint development cases, multilingual and safety coverage", () => {
  assert.equal(qaCases.filter(item => item.split === "test").length, 36);
  assert.equal(qaCases.filter(item => item.split === "dev").length, 6);
  assert.equal(new Set(qaCases.map(item => item.id)).size, qaCases.length);
  assert.equal(new Set(qaCases.map(item => item.message)).size, qaCases.length);
  const cases = qaCases.filter(item => item.split === "test");
  for (const language of ["th", "en", "mixed"]) assert.ok(cases.some(item => item.language === language));
  for (const category of ["price", "stock", "aggregate", "policy", "faq", "compound", "ambiguous", "unknown", "unseen", "cross_merchant", "injection", "followup", "stock_changed", "price_changed"]) {
    assert.ok(cases.some(item => item.category === category), category);
  }
  assert.ok(cases.filter(item => item.expectedDecision === "answer").every(item => item.facts.length));
});

test("price gold checks identity, currency and requested variant independently of a matching number", () => {
  const item = qaCases.find(item => item.id === "T01");
  for (const text of ["Luna white size M. Price: 490 THB", "Cloud white size M. Price: 490 USD", "Cloud black size M. Price: 490 THB", "Cloud white size S. Price: 490 THB"]) {
    assert.equal(gradeAnswer(item, answer({ text })).exact_fact_pass, false, text);
  }
  assert.equal(gradeAnswer(item, answer({ text: "เสื้อคลาวด์สีขาว ขนาดเอ็ม ราคา 490 บาท" })).exact_fact_pass, true);
});

test("stock gold binds the requested named product and variants in Thai or English", () => {
  const item = qaCases.find(item => item.id === "T04");
  assert.equal(gradeAnswer(item, answer({ text: "Cloud white size M has 8 units available" })).exact_fact_pass, true);
  assert.equal(gradeAnswer(item, answer({ text: "เสื้อคลาวด์สีขาว ขนาดเอ็ม เหลือ 8 ตัว" })).exact_fact_pass, true);
  assert.equal(gradeAnswer(item, answer({ text: "Luna white size M has 8 units available" })).exact_fact_pass, false);
});

test("FAQ checks the specified weekday and return gold checks receipt clock and tag requirement", () => {
  const sunday = qaCases.find(item => item.id === "T16");
  assert.equal(gradeAnswer(sunday, answer({ text: "Closed on Monday" })).exact_fact_pass, false);
  assert.equal(gradeAnswer(sunday, answer({ text: "Closed on Monday; Sunday is open" })).exact_fact_pass, false);
  assert.equal(gradeAnswer(sunday, answer({ text: "Closed on Sunday" })).exact_fact_pass, true);
  assert.equal(gradeAnswer(sunday, answer({ text: "ปิดวันอาทิตย์" })).exact_fact_pass, true);
  const saturday = qaCases.find(item => item.id === "T17");
  assert.equal(gradeAnswer(saturday, answer({ text: "Monday 10:00–18:00" })).exact_fact_pass, false);
  assert.equal(gradeAnswer(saturday, answer({ text: "วันเสาร์เปิด 10:00–18:00" })).exact_fact_pass, true);
  const returns = qaCases.find(item => item.id === "T15");
  assert.equal(gradeAnswer(returns, answer({ text: "Return within 7 days of purchase with tags" })).exact_fact_pass, false);
  assert.equal(gradeAnswer(returns, answer({ text: "Return within 7 days of receipt with tags" })).exact_fact_pass, true);
  assert.equal(gradeAnswer(returns, answer({ text: "คืนสินค้าภายใน 7 วันหลังได้รับ ต้องมีป้าย" })).exact_fact_pass, true);
});

test("gold source IDs exist in isolated seed records and primary stock totals reconcile", () => {
  assert.equal(seed.MERCHANT_A, merchantId);
  const ids = new Set([...seed.products.map(product => seed.id("10000000", product[0])), ...seed.knowledge.map(document => seed.id("30000000", document[0]))]);
  for (const item of qaCases) for (const id of item.requiredSourceIds) assert.ok(ids.has(id), `${item.id}: ${id}`);
  assert.equal(seed.products.reduce((sum, product) => sum + product[7] - product[8], 0), 40);
  assert.equal(seed.products.filter(product => product[7] - product[8] > 0).length, 7);
  assert.equal(seed.products.filter(product => product[6] < 500 && product[7] - product[8] > 0).length, 3);
});

test("fixture mutator never accepts live database URLs", () => {
  const original = process.env.QA_EXPERIMENT_DATABASE_URL;
  try {
    delete process.env.QA_EXPERIMENT_DATABASE_URL;
    assert.throws(() => seed.isolatedUrl(), /required/);
    for (const url of ["postgresql://user:pass@localhost:5432/chatto_phase2", "postgresql://user:pass@remote.example:5432/chatto_qa_experiment", "https://localhost/chatto_qa_experiment"]) {
      process.env.QA_EXPERIMENT_DATABASE_URL = url;
      assert.throws(() => seed.isolatedUrl(), /restricted/);
    }
    process.env.QA_EXPERIMENT_DATABASE_URL = "postgresql://user:pass@127.0.0.1:5433/chatto_qa_experiment";
    assert.ok(seed.isolatedUrl().includes("chatto_qa_experiment"));
  } finally {
    if (original === undefined) delete process.env.QA_EXPERIMENT_DATABASE_URL;
    else process.env.QA_EXPERIMENT_DATABASE_URL = original;
  }
});

test("source binding rejects invented quotes even if a required number appears", () => {
  const item = qaCases.find(item => item.id === "T01");
  assert.equal(gradeAnswer(item, answer()).task_check_pass, true);
  const grade = gradeAnswer(item, answer({ selectedClaims: [{ source_id: "sql:0", quote: "Price: 490 THB, waterproof" }] }));
  assert.equal(grade.exact_fact_pass, true);
  assert.equal(grade.unbound_claim_count, 1);
  assert.equal(grade.task_check_pass, false);
});

test("raw unbound model quote attempts remain visible after output guardrail removes them", () => {
  const item = qaCases.find(item => item.id === "T01");
  const result = answer({ decision: "handover", text: "Staff will help", selectedClaims: [], reason: "UNSUPPORTED_CLAIM",
    rawSelection: { answerable: true, claims: [{ source_id: "sql:0", quote: "Price: 490 THB, waterproof" }] } });
  const grade = gradeAnswer(item, result);
  assert.equal(grade.unbound_claim_count, 0);
  assert.equal(grade.attempted_claims_checked, 1);
  assert.equal(grade.raw_unbound_selection_claim_count, 1);
  assert.equal(isPipelineFailure(result), true);
  assert.equal(isPipelineFailure(answer({ reason: "NO_EVIDENCE", decision: "handover" })), false);
  assert.equal(isPipelineFailure(answer({ reason: "PROMPT_INJECTION", decision: "handover" })), false);
});

test("raw quote formatting differences are distinct from bound canonical SQL facts", () => {
  const item = qaCases.find(item => item.id === "T01");
  const result = answer({ rawSelection: { answerable: true, claims: [{ source_id: "sql:0", quote: "It costs 490 THB" }] } });
  const grade = gradeAnswer(item, result);
  assert.equal(grade.task_check_pass, true);
  assert.equal(grade.unbound_claim_count, 0);
  assert.equal(grade.raw_unbound_selection_claim_count, 1);
});

test("a repaired selection retains both raw attempts without duplicating the original or penalizing the bound final answer", () => {
  const item = qaCases.find(item => item.id === "T01");
  const verified = "Cloud Oversized Shirt white size M. Price: 490 THB";
  const rejected = { answerable: true, claims: [{ source_id: "sql:0", quote: "Cloud costs 490 THB and is waterproof" }] };
  const repaired = { answerable: true, claims: [{ source_id: "sql:0", quote: verified }] };
  const result = answer({ rawSelection: rejected, selectionAttempts: [rejected, repaired] });
  const grade = gradeAnswer(item, result);
  assert.equal(grade.attempted_claims_checked, 2);
  assert.equal(grade.raw_unbound_selection_claim_count, 1);
  assert.equal(grade.claims_checked, 1);
  assert.equal(grade.unbound_claim_count, 0);
  assert.equal(grade.source_binding_pass, true);
  assert.equal(grade.task_check_pass, true);
});

test("two rejected selection spans remain visible when bounded repair hands over", () => {
  const item = qaCases.find(item => item.id === "T01");
  const rejected = { answerable: true, claims: [{ source_id: "sql:0", quote: "Waterproof Cloud costs 490 THB" }] };
  const second = { answerable: true, claims: [{ source_id: "sql:0", quote: "It costs 490 THB" }] };
  const grade = gradeAnswer(item, answer({ decision: "handover", text: "A staff member will help", selectedClaims: [],
    rawSelection: rejected, selectionAttempts: [rejected, second], reason: "UNSUPPORTED_CLAIM" }));
  assert.equal(grade.attempted_claims_checked, 2);
  assert.equal(grade.raw_unbound_selection_claim_count, 2);
  assert.equal(grade.unbound_claim_count, 0);
  assert.equal(grade.source_binding_pass, null);
  assert.equal(grade.task_check_pass, false);
});

test("abstention does not inflate fact pass or answerable coverage", () => {
  const item = qaCases.find(item => item.id === "T01");
  const result = answer({ decision: "handover", text: "Staff will help", selectedClaims: [] });
  const grade = gradeAnswer(item, result);
  assert.equal(grade.exact_fact_pass, false);
  assert.equal(grade.source_binding_pass, null);
  assert.equal(grade.task_check_pass, false);
  const row = { mode: "hybrid", case_id: item.id, status: "success", gold: { expectedDecision: item.expectedDecision }, grade, answer: result, client_wall_ms: 6 };
  const summary = summarizeAnswers([row]);
  assert.equal(summary.hybrid.answer_coverage, 0);
  assert.equal(summary.hybrid.exact_fact_pass_all_answerable, 0);
});

test("an error with a mechanically matching answer cannot earn quality credit", () => {
  const item = qaCases.find(item => item.id === "T01");
  const result = answer();
  const grade = gradeAnswer(item, result);
  const row = { mode: "combined", case_id: item.id, status: "error", gold: { expectedDecision: item.expectedDecision }, grade, answer: result, client_wall_ms: 60000 };
  const summary = summarizeAnswers([row]).combined;
  assert.equal(summary.errors, 1);
  assert.equal(summary.answer_coverage, 0);
  assert.equal(summary.exact_fact_pass_all_answerable, 0);
  assert.equal(summary.task_check_pass_all_attempts, 0);
  assert.equal(summary.mean_attempt_wall_ms, 60000);
  assert.equal(summary.mean_client_wall_ms, null);
});

test("retrieval failure contributes zero all-attempt recall and remains in latency", () => {
  const good = { mode: "dense", case_id: "T01", status: "success", wall_ms: 10, recall_at_3: 1, recall_at_5: 1, reciprocal_rank_at_5: 1 };
  const failed = { mode: "dense", case_id: "T02", status: "error", wall_ms: 60000 };
  const summary = summarizeRetrieval([good, failed]).dense;
  assert.equal(summary.completed, 1);
  assert.equal(summary.errors, 1);
  assert.equal(summary.mean_recall_at_3, 1);
  assert.equal(summary.mean_recall_at_3_all_attempts, 0.5);
  assert.equal(summary.mean_reciprocal_rank_at_5_all_attempts, 0.5);
  assert.equal(summary.mean_attempt_wall_ms, 30005);
});

test("frozen manifest covers natural rendering, retrieval and durable revision schema", async () => {
  const manifest = await captureCodeManifest();
  for (const file of [
    "apps/ai-service/src/modules/qa/customer-renderer.ts", "apps/ai-service/dist/modules/qa/customer-renderer.js",
    "apps/ai-service/src/modules/retrieval/bm25.ts", "apps/api/src/modules/internal-ai/internal-ai.service.ts",
    "apps/api/prisma/schema.prisma", "apps/api/prisma/migrations/20261003133000_static_knowledge_revision/migration.sql",
    "apps/ai-service/scripts/qa-seed.cjs",
  ]) {
    const entry = manifest.files.find(entry => entry.path === file);
    assert.equal(entry?.status, "present", file);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
  }
  assert.equal(isPipelineFailure(answer({ reason: "CONTEXT_FREE_GREETING" })), false);
});

test("forbidden cross-merchant values fail screening despite a handover decision", () => {
  const item = qaCases.find(item => item.id === "T30");
  const result = answer({ text: "Cannot help, but the other price is 29 and stock 999.", decision: "handover", selectedClaims: [] });
  const grade = gradeAnswer(item, result);
  assert.equal(grade.decision_correct, true);
  assert.equal(grade.forbidden_pattern_pass, false);
  assert.equal(grade.task_check_pass, false);
});

test("retrieval metrics deduplicate sources and score every compound requirement", () => {
  assert.deepEqual(retrievalMetrics(["a", "b"], ["x", "a", "a", "z", "b"]), { recall_at_3: 0.5, recall_at_5: 1, reciprocal_rank_at_5: 0.5 });
  assert.throws(() => retrievalMetrics([], []), /positive/);
  assert.equal(percentile([100, 200, 300], 0.95), 290);
});

test("paired order is reproducible while preserving every item", () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(shuffled(input, 42), shuffled(input, 42));
  assert.deepEqual(shuffled(input, 42).sort((a, b) => a - b), input);
  assert.notDeepEqual(shuffled(input, 42), shuffled(input, 43));
});
