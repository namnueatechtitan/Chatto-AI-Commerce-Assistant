const assert = require("node:assert/strict");
const test = require("node:test");
require("reflect-metadata");
const { AiSafetyService } = require("../dist/modules/ai-integration/ai-safety.service");
const { assertAiChatResponse } = require("../dist/modules/ai-integration/ai-response.validator");
const { AiIntegrationService } = require("../dist/modules/ai-integration/ai-integration.service");
const { ConversationStatus } = require("@prisma/client");
const request = { request_id: "request-1", merchant_id: "merchant-a", conversation_id: "conversation-a", customer: { id: "customer-a" }, message: { id: "message-a", text: "secret user text", timestamp: "2026-09-05T00:00:00Z" }, channel: "line" };
function response(handover = true) {
  return { request_id: request.request_id, merchant_id: request.merchant_id, conversation_id: request.conversation_id, intent: "product_question",
    reply: { text: "Staff review is needed.", confidence: handover ? 0.2 : 0.9 },
    actions: [], sources: [], handover_required: handover, handover_reason: handover ? "NO_EVIDENCE" : undefined,
    confidence: { score: handover ? 0.2 : 0.9, threshold: 0.65, level: handover ? "low" : "high", decision: handover ? "handover" : "answer", reasons: handover ? ["NO_EVIDENCE"] : [], signals: { intent: 0.8, evidence: handover ? 0 : 1, source_count: handover ? 0 : 1 } },
    guardrails: [{ allowed: true, severity: "low", stage: "input", reasons: [], requires_handover: false }] };
}
function database({ status = ConversationStatus.AI_ACTIVE, ticket = false } = {}) {
  const state = { logs: [], events: [], tickets: ticket ? [{}] : [], conversation: { status }, locks: [] };
  const transaction = {
    $queryRaw: async sql => { state.locks.push(sql); return [{ id: request.conversation_id }]; },
    conversation: {
      findUniqueOrThrow: async () => state.conversation,
      update: async ({ data }) => Object.assign(state.conversation, data),
    },
    aiActionLog: { findFirst: async ({ where }) => state.logs.find(log => log.inputJson.request_id === where.inputJson.equals), create: async ({ data }) => { state.logs.push(data); return data; } },
    guardrailEvent: { create: async ({ data }) => { state.events.push(data); return data; } },
    handoverTicket: { findFirst: async () => state.tickets[0], create: async ({ data }) => { state.tickets.push(data); return data; } },
  };
  const prisma = { conversation: { findFirst: async () => state.conversation }, $transaction: async fn => fn(transaction) };
  return { service: new AiSafetyService(prisma), state, transaction, prisma };
}

test("backend validates matched IDs, bounded score and safety decision", () => {
  assert.doesNotThrow(() => assertAiChatResponse(response(), request));
  const variations = [value => value.merchant_id = "other", value => value.request_id = "other", value => value.conversation_id = "other", value => value.reply.confidence = NaN, value => value.reply.text = "", value => value.actions.push({ type: "place_order" }), value => value.handover_required = false, value => value.guardrails = null];
  for (const edit of variations) { const value = response(); edit(value); assert.throws(() => assertAiChatResponse(value, request), /INVALID_AI_SERVICE_RESPONSE/); }
});
test("backend rejects answer when guardrail requires human review", () => {
  const value = response(false); value.guardrails[0].requires_handover = true;
  assert.throws(() => assertAiChatResponse(value, request), /INVALID_AI_SERVICE_RESPONSE/);
});
test("handover atomically creates audit log, ticket and conversation transition", async () => {
  const { service, state } = database();
  assert.equal(await service.record(request, response()), true);
  assert.equal(state.logs.length, 1); assert.equal(state.tickets.length, 1);
  assert.equal(state.logs[0].status, "HUMAN_REVIEW_REQUIRED");
  assert.equal(state.conversation.status, "HANDOVER_REQUESTED");
  assert.equal(state.conversation.ownerType, "human");
  assert.match(state.locks[0].strings.join("?"), /FOR UPDATE/);
  assert.deepEqual(state.locks[0].values, [request.conversation_id, request.merchant_id, request.customer.id]);
});
test("same request is audited once and cannot send a second reply", async () => {
  const { service, state } = database();
  assert.equal(await service.record(request, response(false)), true);
  assert.equal(await service.record(request, response(false)), false);
  assert.equal(state.logs.length, 1);
});
test("existing open ticket is reused", async () => {
  const { service, state } = database({ ticket: true });
  await service.record(request, response());
  assert.equal(state.tickets.length, 1);
});
test("human-active and handover-requested conversations suppress further AI replies", async () => {
  for (const status of ["HUMAN_ACTIVE", "HANDOVER_REQUESTED"]) {
    const { service, state } = database({ status });
    assert.equal(await service.isAiActive(request), false);
    assert.equal(await service.record(request, response()), false);
    assert.equal(state.logs.length, 0);
  }
});
test("guardrail audit stores reason codes without raw customer secrets or rejected text", async () => {
  const { service, state } = database(); const value = response();
  value.guardrails = [{ allowed: false, severity: "high", stage: "input", reasons: ["SENSITIVE_CREDENTIAL"], requires_handover: true }];
  await service.record(request, value);
  assert.equal(state.events.length, 1); assert.equal(state.events[0].severity, "HIGH");
  assert.equal(state.logs[0].status, "REJECTED");
  assert.equal(state.tickets[0].priority, "HIGH");
  assert.doesNotMatch(JSON.stringify(state), /secret user text/);
});
test("missing merchant/customer-scoped conversation cannot be persisted", async () => {
  const { service, transaction, state } = database(); transaction.$queryRaw = async () => [];
  await assert.rejects(service.record(request, response()), /Conversation not found/);
  assert.equal(state.logs.length, 0);
});
test("audit persistence failure propagates to stop delivery", async () => {
  const { service, transaction } = database(); transaction.aiActionLog.create = async () => { throw new Error("database unavailable"); };
  await assert.rejects(service.record(request, response()), /database unavailable/);
});
test("integration enriches context, validates response and persists before returning", async () => {
  const calls = []; const original = global.fetch;
  const internal = { exportMerchantSettings: async () => ({}), exportProducts: async () => ({}), exportKnowledgeBase: async () => ({}), exportVectorDocuments: async () => [], exportConversationHistory: async () => [] };
  const safety = { isAiActive: async () => true, record: async () => { calls.push("persist"); return true; } };
  global.fetch = async (url, options) => { calls.push("fetch"); assert.match(url, /\/mcp\/chat$/); assert.equal(options.headers["X-Merchant-Id"], request.merchant_id); assert.ok(JSON.parse(options.body).ai_context); return { ok: true, json: async () => response() }; };
  try { const value = await new AiIntegrationService(internal, safety).chat(request); assert.equal(value.handover_required, true); assert.deepEqual(calls, ["fetch", "persist"]); }
  finally { global.fetch = original; }
});
test("integration stops before context and provider when human has taken over", async () => {
  const service = new AiIntegrationService({}, { isAiActive: async () => false });
  await assert.rejects(service.chat(request), /awaiting human support/);
});

test("unavailable or malformed AI service produces a persisted safe handover", async () => {
  const original = global.fetch;
  const internal = { exportMerchantSettings: async () => ({}), exportProducts: async () => ({}), exportKnowledgeBase: async () => ({}), exportVectorDocuments: async () => [], exportConversationHistory: async () => [] };
  try {
    for (const mode of ["network", "timeout", "malformed", "wrong-tenant"]) {
      let persisted;
      global.fetch = async () => {
        if (mode === "network") throw new Error("private upstream detail");
        if (mode === "timeout") { const error = new Error("aborted"); error.name = "AbortError"; throw error; }
        return { ok: true, json: async () => mode === "wrong-tenant" ? { ...response(), merchant_id: "other" } : {} };
      };
      const safety = { isAiActive: async () => true, record: async (_req, value) => { persisted = value; return true; } };
      const result = await new AiIntegrationService(internal, safety).chat(request);
      assert.equal(result, persisted); assert.equal(result.handover_required, true); assert.equal(result.reply.confidence, 0);
      assert.equal(result.handover_reason, mode === "timeout" ? "AI_SERVICE_TIMEOUT" : "AI_SERVICE_UNAVAILABLE");
      assert.doesNotThrow(() => assertAiChatResponse(result, request));
      assert.doesNotMatch(JSON.stringify(result), /private upstream detail/);
    }
  } finally { global.fetch = original; }
});
