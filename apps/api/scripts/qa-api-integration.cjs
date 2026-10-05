/* Explicitly opt-in; never connects to the application's ordinary database. */
const assert = require("node:assert/strict");
const { createHmac, randomUUID } = require("node:crypto");

if (process.env.RUN_QA_API_INTEGRATION !== "1") {
  console.log("Skipped isolated PostgreSQL integration checks; set RUN_QA_API_INTEGRATION=1 explicitly.");
  process.exit(0);
}

const api = new URL(process.env.QA_API_BASE_URL || "");
const database = new URL(process.env.QA_DATABASE_URL || "");
assert.equal(api.protocol, "http:");
assert.equal(api.hostname, "127.0.0.1");
assert.equal(api.port, "4400");
assert.ok(["postgresql:", "postgres:"].includes(database.protocol));
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.port, "55432");
assert.equal(database.pathname, "/chatto_qa_experiment");
assert.ok(process.env.QA_INTERNAL_TOKEN, "QA_INTERNAL_TOKEN is required");

require("reflect-metadata");
const { Logger } = require("@nestjs/common");
const { PrismaClient } = require("@prisma/client");
const { InternalAiService } = require("../dist/modules/internal-ai/internal-ai.service");
const { AiSafetyService } = require("../dist/modules/ai-integration/ai-safety.service");
const { AiIntegrationService } = require("../dist/modules/ai-integration/ai-integration.service");
const { LineSignatureService } = require("../dist/modules/line-webhooks/line-signature.service");
const { LineWebhooksService } = require("../dist/modules/line-webhooks/line-webhooks.service");
Logger.overrideLogger(false);

const prisma = new PrismaClient({ datasources: { db: { url: database.href } } });
const merchantA = "11111111-1111-4111-8111-111111111111";
const merchantB = "22222222-2222-4222-8222-222222222222";
const checks = [];

async function request(path, body, token = process.env.QA_INTERNAL_TOKEN) {
  const response = await fetch(new URL(path, api), {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}
async function query(sql, merchant_id = merchantA) {
  const result = await request("/internal/ai/query", { merchant_id, sql });
  assert.ok(result.status >= 200 && result.status < 300, `Query returned HTTP ${result.status}`);
  assert.equal(result.payload.truncated, false);
  return result.payload.rows;
}
async function corpusState() {
  return JSON.stringify(await Promise.all([
    prisma.product.findMany({ orderBy: { id: "asc" } }),
    prisma.productVariant.findMany({ orderBy: { id: "asc" } }),
    prisma.knowledgeBaseDocument.findMany({ orderBy: { id: "asc" } }),
  ]));
}
async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error("Timed out waiting for isolated chat persistence");
}

async function checkQueries() {
  const before = await corpusState();
  assert.deepEqual(await query("SELECT name, price, currency, available_qty FROM catalog WHERE name ILIKE '%Cloud%'"),
    [{ name: "Cloud Oversized Shirt", price: 490, currency: "THB", available_qty: 8 }]);
  checks.push("live decimal price and available stock (10 on hand minus 2 reserved = 8)");

  const lookup = await query("SELECT product_id, name, sku, variant_name, color, size, price, currency, available_qty FROM catalog WHERE product_id IN ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005') ORDER BY price LIMIT 20");
  assert.deepEqual(lookup.map(row => row.name), ["Sand Canvas Tote", "Ink Basic Tee"]);
  assert.equal((await query("SELECT product_id FROM catalog WHERE product_id = '10000000-0000-4000-8000-000000000001'"))[0].product_id,
    "10000000-0000-4000-8000-000000000001");
  assert.equal((await query("SELECT product_id FROM catalog WHERE product_id IN ('10000000-0000-4000-8000-000000000001')"))[0].product_id,
    "10000000-0000-4000-8000-000000000001");
  const knowledge = await query("SELECT id, title FROM knowledge ORDER BY title LIMIT 1");
  assert.equal((await query(`SELECT id FROM knowledge WHERE id IN ('${knowledge[0].id}')`))[0].id, knowledge[0].id);
  checks.push("UUID identifiers work with equality and IN hydration for both scoped relations");

  assert.deepEqual(await query("SELECT COUNT(*) AS rows, COUNT(DISTINCT product_id) AS products, MIN(price) AS minimum, MAX(price) AS maximum, SUM(price) AS total, AVG(price) AS mean, SUM(available_qty) AS available FROM catalog"),
    [{ count_catalog_rows: 8, count_distinct_product_id: 8, min_price: 250, max_price: 1290, sum_price: 4780, avg_price: 597.5, sum_available_qty: 40 }]);
  assert.deepEqual(await query("SELECT SUM(price) AS total_units FROM catalog GROUP BY currency HAVING total_units > 0 ORDER BY total_units"), [{ sum_price: 4780 }]);
  assert.deepEqual(await query("SELECT COUNT(*) AS products FROM knowledge"), [{ count_knowledge_rows: 6 }]);
  checks.push("database aggregates and row-versus-distinct-product counts");

  const tenantBRows = await query("SELECT name, price FROM catalog WHERE price > 0", merchantB);
  assert.deepEqual(tenantBRows, [{ name: "Secret Reserve Item", price: 29 }]);
  assert.deepEqual(await query("SELECT name FROM catalog WHERE name ILIKE '%Cloud%'", merchantB), []);
  assert.deepEqual(await query("SELECT name FROM catalog WHERE name ILIKE '%Secret%'"), []);
  assert.deepEqual(await query("SELECT id, title FROM knowledge", merchantB), []);
  assert.equal((await query("SELECT name FROM catalog WHERE name ILIKE '%Secret%' OR 1 = 1")).length, 8);
  checks.push("tenant B cannot read A; tenant A cannot read B even with OR true");

  assert.deepEqual(await query("SELECT name FROM catalog WHERE name = 'x''; DROP TABLE products; --'"), []);
  for (const sql of [
    "DELETE FROM products", "UPDATE catalog SET price = 1", "SELECT name FROM catalog; DELETE FROM products",
    "SELECT * FROM public.catalog", "SELECT * FROM products", "SELECT * FROM pg_catalog.pg_authid",
    "SELECT merchant_id FROM catalog", "WITH catalog AS (SELECT * FROM products) SELECT * FROM catalog",
    "SELECT pg_sleep(10) FROM catalog", "SELECT name FROM catalog WHERE name = $1",
    "SELECT name FROM catalog WHERE price = (SELECT 1 FROM knowledge)", "SELECT name FROM catalog FOR UPDATE",
    "SELECT price AS available_qty FROM catalog", "SELECT SUM(price) AS available_qty FROM catalog",
  ]) {
    assert.equal((await request("/internal/ai/query", { merchant_id: merchantA, sql })).status, 400, sql);
  }
  assert.equal((await request("/internal/ai/query", { merchant_id: "bad", sql: "SELECT name FROM catalog" })).status, 400);
  assert.equal((await request("/internal/ai/query", {})).status, 400);
  checks.push("quoted injection remains a literal; writes, schemas, private data and execution functions are rejected");

  for (const token of ["", "wrong-token"]) {
    assert.equal((await request("/internal/ai/query", { merchant_id: merchantA, sql: "SELECT name FROM catalog" }, token)).status, 401);
    assert.equal((await request(`/internal/ai/knowledge-version?merchant_id=${merchantA}`, undefined, token)).status, 401);
    assert.equal((await request(`/internal/ai/knowledge-snapshot?merchant_id=${merchantA}`, undefined, token)).status, 401);
  }
  checks.push("all new endpoints reject missing and invalid internal authentication");

  const version = await request(`/internal/ai/knowledge-version?merchant_id=${merchantA}`);
  assert.equal(version.status, 200);
  assert.match(version.payload.revision, /^\d+$/);
  assert.equal(version.payload.version, `${merchantA}:${version.payload.revision}`);
  assert.equal(version.payload.counts, undefined, "Version checks must not scan corpus aggregates");
  const snapshotA = await request(`/internal/ai/knowledge-snapshot?merchant_id=${merchantA}`);
  const snapshotB = await request(`/internal/ai/knowledge-snapshot?merchant_id=${merchantB}`);
  assert.equal(snapshotA.status, 200);
  assert.equal(snapshotA.payload.products.products.length, 8);
  assert.equal(snapshotA.payload.knowledge_base.knowledge_base.length, 6);
  assert.equal(snapshotB.payload.products.products.length, 1);
  assert.equal(snapshotB.payload.knowledge_base.knowledge_base.length, 0);
  assert.equal(await corpusState(), before);
  checks.push("index version and snapshot stay scoped; all query checks leave the corpus unchanged");
}

async function version(merchantId = merchantA) {
  const result = await request(`/internal/ai/knowledge-version?merchant_id=${merchantId}`);
  assert.equal(result.status, 200);
  return result.payload.version;
}

async function checkStaticRevision() {
  const beforeCorpus = await corpusState();
  const product = await prisma.product.findUniqueOrThrow({ where: { id: "10000000-0000-4000-8000-000000000001" } });
  const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id, merchantId: merchantA } });
  let temporaryDocument;
  let temporaryMerchant;
  try {
    const initial = await version();
    const initialB = await version(merchantB);
    await prisma.productVariant.update({ where: { id: variant.id }, data: {
      price: Number(variant.price) + 1, stockOnHand: variant.stockOnHand + 2,
      stockReserved: variant.stockReserved + 1, lowStockThreshold: (variant.lowStockThreshold || 0) + 1,
    } });
    assert.equal(await version(), initial);
    assert.deepEqual(await query("SELECT price, available_qty FROM catalog WHERE name ILIKE '%Cloud%'"), [{ price: 491, available_qty: 9 }]);
    await prisma.productVariant.update({ where: { id: variant.id }, data: { stockOnHand: null } });
    assert.equal(await version(), initial);
    assert.deepEqual(await query("SELECT available_qty FROM catalog WHERE name ILIKE '%Cloud%'"), [{ available_qty: null }]);
    const unknownStockSnapshot = await request(`/internal/ai/knowledge-snapshot?merchant_id=${merchantA}`);
    const unknownStockVariant = unknownStockSnapshot.payload.products.products.find(row => row.id === product.id).variants.find(row => row.id === variant.id);
    assert.equal(unknownStockVariant.stock_qty, null);
    assert.equal(unknownStockVariant.available_qty, null);
    await prisma.$executeRaw`UPDATE product_variants SET price = price + 1 WHERE id = ${variant.id}::uuid AND merchant_id = ${merchantA}::uuid`;
    assert.equal(await version(), initial);
    assert.deepEqual(await query("SELECT price FROM catalog WHERE name ILIKE '%Cloud%'"), [{ price: 492 }]);
    checks.push("price, stock, reservation and timestamp writes leave the static revision unchanged; SQL reads fresh and unknown values");

    const description = `${product.description || ""} QA_STATIC_REVISION_CHECK`;
    await prisma.product.update({ where: { id: product.id }, data: { description } });
    const edited = await version();
    assert.notEqual(edited, initial);
    assert.equal(await version(merchantB), initialB);
    await prisma.product.update({ where: { id: product.id }, data: { description } });
    assert.equal(await version(), edited, "No-op assignments must not invalidate the static index");
    await prisma.product.update({ where: { id: product.id }, data: { status: "INACTIVE" } });
    const inactive = await version();
    assert.notEqual(inactive, edited);
    assert.deepEqual(await query("SELECT name FROM catalog WHERE name ILIKE '%Cloud%'"), []);
    await prisma.productVariant.update({ where: { id: variant.id }, data: { color: "qa-static-colour" } });
    const recoloured = await version();
    assert.notEqual(recoloured, inactive);
    await prisma.$executeRaw`UPDATE products SET category = ${`${product.category || ""} QA_DIRECT_STATIC_WRITE`} WHERE id = ${product.id}::uuid AND merchant_id = ${merchantA}::uuid`;
    assert.notEqual(await version(), recoloured);
    checks.push("product description/status and variant colour edits invalidate; no-op assignments do not");
    checks.push("direct SQL price writes keep the revision; direct SQL static category edits invalidate it");

    const beforeInsert = await version();
    temporaryDocument = await prisma.knowledgeBaseDocument.create({ data: {
      merchantId: merchantA, type: "faq", title: "QA temporary revision check", content: "QA temporary static text", status: "ACTIVE",
    } });
    const afterInsert = await version();
    assert.notEqual(afterInsert, beforeInsert);
    await prisma.knowledgeBaseDocument.update({ where: { id: temporaryDocument.id }, data: { content: "QA edited temporary static text" } });
    const afterEdit = await version();
    assert.notEqual(afterEdit, afterInsert);
    const beforeMoveB = await version(merchantB);
    await prisma.knowledgeBaseDocument.update({ where: { id: temporaryDocument.id }, data: { merchantId: merchantB } });
    assert.notEqual(await version(), afterEdit);
    assert.notEqual(await version(merchantB), beforeMoveB);
    const beforeDeleteB = await version(merchantB);
    await prisma.knowledgeBaseDocument.delete({ where: { id: temporaryDocument.id } });
    temporaryDocument = null;
    assert.notEqual(await version(merchantB), beforeDeleteB);
    checks.push("knowledge insert/edit/delete invalidate; moving a document invalidates both old and new tenants");

    temporaryMerchant = await prisma.merchant.create({ data: { shopName: "QA temporary cascade fixture", slug: `qa-revision-${randomUUID()}`, status: "TRIAL" } });
    assert.equal(await version(temporaryMerchant.id), `${temporaryMerchant.id}:0`);
    for (const status of ["INACTIVE", "SUSPENDED"]) {
      await prisma.merchant.update({ where: { id: temporaryMerchant.id }, data: { status } });
      assert.equal((await request(`/internal/ai/knowledge-version?merchant_id=${temporaryMerchant.id}`)).status, 404);
      assert.equal((await request(`/internal/ai/knowledge-snapshot?merchant_id=${temporaryMerchant.id}`)).status, 404);
      assert.equal((await request("/internal/ai/query", { merchant_id: temporaryMerchant.id, sql: "SELECT name FROM catalog" })).status, 404);
    }
    await prisma.merchant.update({ where: { id: temporaryMerchant.id }, data: { status: "TRIAL" } });
    checks.push("disabled merchants cannot read version, snapshot or SQL endpoints; unknown stock remains NULL in snapshots");
    const temporaryProduct = await prisma.product.create({ data: { merchantId: temporaryMerchant.id, name: "QA cascade product", status: "ACTIVE" } });
    const temporaryVariant = await prisma.productVariant.create({ data: { merchantId: temporaryMerchant.id, productId: temporaryProduct.id, variantName: "QA cascade variant", status: "ACTIVE" } });
    await prisma.knowledgeBaseDocument.create({ data: { merchantId: temporaryMerchant.id, type: "faq", title: "QA cascade document", content: "QA cascade text", status: "ACTIVE" } });
    assert.equal(await version(temporaryMerchant.id), `${temporaryMerchant.id}:3`);
    await prisma.productVariant.delete({ where: { id: temporaryVariant.id } });
    assert.equal(await version(temporaryMerchant.id), `${temporaryMerchant.id}:4`);
    await prisma.product.delete({ where: { id: temporaryProduct.id } });
    assert.equal(await version(temporaryMerchant.id), `${temporaryMerchant.id}:5`);
    const deletedMerchantId = temporaryMerchant.id;
    await prisma.merchant.delete({ where: { id: temporaryMerchant.id } });
    temporaryMerchant = null;
    assert.equal(await prisma.merchantKnowledgeRevision.count({ where: { merchantId: deletedMerchantId } }), 0);
    assert.equal((await request(`/internal/ai/knowledge-version?merchant_id=${deletedMerchantId}`)).status, 404);
    checks.push("new merchants start at zero; product/variant lifecycle revisions persist; merchant cascade deletes remain valid");
  } finally {
    if (temporaryDocument) await prisma.knowledgeBaseDocument.delete({ where: { id: temporaryDocument.id } });
    if (temporaryMerchant) await prisma.merchant.delete({ where: { id: temporaryMerchant.id } });
    await prisma.product.update({ where: { id: product.id }, data: { description: product.description, category: product.category, status: product.status, updatedAt: product.updatedAt } });
    await prisma.productVariant.update({ where: { id: variant.id }, data: { color: variant.color, price: variant.price,
      stockOnHand: variant.stockOnHand, stockReserved: variant.stockReserved,
      lowStockThreshold: variant.lowStockThreshold, updatedAt: variant.updatedAt } });
  }
  assert.equal(await corpusState(), beforeCorpus, "Static revision checks must restore all fixture data");
}

function fakeAiResponse(input, handover) {
  return {
    request_id: input.request_id, merchant_id: input.merchant_id, conversation_id: input.conversation_id,
    intent: "product_question", reply: { confidence: 0, text: handover
      ? "I do not have enough reliable information. A staff member will help with this question."
      : "Please specify the product, variant or colour so I can answer accurately." },
    actions: [], sources: [], clarification_required: !handover, handover_required: handover,
    ...(handover ? { handover_reason: "AMBIGUOUS_QUESTION" } : {}),
    confidence: { score: 0, threshold: 0.65, level: "low", decision: handover ? "handover" : "clarify",
      reasons: ["AMBIGUOUS_QUESTION"], signals: { intent: 0, evidence: 0, source_count: 0 } },
    guardrails: [{ allowed: !handover, severity: handover ? "high" : "low", stage: "output",
      reasons: ["AMBIGUOUS_QUESTION"], requires_handover: handover }],
  };
}

async function checkLinePersistence() {
  const marker = `qa-persistence-${randomUUID()}`;
  const secret = "qa-local-signature-only";
  const config = { get: key => ({ LINE_CHANNEL_ID: marker, LINE_CHANNEL_SECRET: secret, LINE_CHANNEL_ACCESS_TOKEN: "" })[key] };
  let createdPlatform = false;
  let channel;
  const originalFetch = global.fetch;
  const oldContextMode = process.env.AI_CONTEXT_MODE;
  let providerCalls = 0;
  const received = [];
  try {
    let platform = await prisma.platform.findUnique({ where: { code: "line" } });
    if (!platform) {
      platform = await prisma.platform.create({ data: { code: "line", name: "LINE QA local fixture", status: "active" } });
      createdPlatform = true;
    }
    channel = await prisma.channel.create({ data: { merchantId: merchantA, platformId: platform.id,
      channelName: marker, externalChannelId: marker, status: "CONNECTED", isConnected: true } });
    delete process.env.AI_CONTEXT_MODE;
    global.fetch = async (url, options) => {
      assert.ok(String(url).endsWith("/mcp/chat"), "The persistence check must never call external LINE services");
      const input = JSON.parse(options.body);
      received.push(input);
      providerCalls += 1;
      return new Response(JSON.stringify(fakeAiResponse(input, providerCalls > 1)), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const integration = new AiIntegrationService(new InternalAiService(prisma), new AiSafetyService(prisma));
    const service = new LineWebhooksService(prisma, config, new LineSignatureService(config), integration);
    const makeEvent = number => {
      const payload = { destination: "qa-local-destination", events: [{ type: "message", timestamp: Date.now(),
        webhookEventId: `${marker}-${number}`, replyToken: "qa-local-reply-token", source: { type: "user", userId: marker },
        message: { type: "text", id: `${marker}-message-${number}`, text: "Which one?" } }] };
      const raw = Buffer.from(JSON.stringify(payload));
      return [payload, createHmac("sha256", secret).update(raw).digest("base64"), raw];
    };
    const first = makeEvent(1);
    await assert.rejects(service.handleWebhook(first[0], "invalid-signature", first[2]), /Invalid LINE signature/);
    assert.equal(await prisma.customer.count({ where: { channelId: channel.id } }), 0);
    assert.equal((await service.handleWebhook(...first)).processedEvents, 1);
    await waitFor(() => prisma.message.findFirst({ where: { conversation: { channelId: channel.id }, senderType: "AI" } }));
    const conversation = await prisma.conversation.findFirstOrThrow({ where: { channelId: channel.id } });
    assert.equal(conversation.status, "AI_ACTIVE");
    assert.equal(await prisma.message.count({ where: { conversationId: conversation.id } }), 2);
    assert.equal(await prisma.aiActionLog.count({ where: { conversationId: conversation.id, status: "VALIDATED" } }), 1);
    const clarification = await prisma.message.findFirstOrThrow({ where: { conversationId: conversation.id, senderType: "AI" } });
    assert.equal(clarification.metadata.ai.confidenceDetails.decision, "clarify");
    assert.equal(clarification.metadata.line.reply.attempted, false);
    assert.equal(clarification.metadata.line.reply.delivered, false);
    assert.equal(received[0].ai_options.backend_retrieval, true);
    assert.deepEqual(Object.keys(received[0].ai_context).sort(), ["conversation_history", "merchant_settings"]);
    assert.equal((await service.handleWebhook(...first)).duplicateEvents, 1);
    assert.equal(providerCalls, 1);
    assert.equal(await prisma.message.count({ where: { conversationId: conversation.id } }), 2);
    checks.push("real LINE signature validation, customer/conversation/message persistence, audit and duplicate suppression");

    assert.equal((await service.handleWebhook(...makeEvent(2))).processedEvents, 1);
    await waitFor(async () => (await prisma.message.count({ where: { conversationId: conversation.id, senderType: "AI" } })) === 2);
    assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).status, "HANDOVER_REQUESTED");
    assert.equal(await prisma.handoverTicket.count({ where: { conversationId: conversation.id } }), 1);
    assert.ok(received[1].ai_context.conversation_history.some(message => message.sender_type === "ai" && message.content === clarification.content));
    assert.equal((await service.handleWebhook(...makeEvent(3))).processedEvents, 1);
    assert.equal(providerCalls, 2);
    assert.equal(await prisma.message.count({ where: { conversationId: conversation.id, senderType: "CUSTOMER" } }), 3);
    assert.equal(await prisma.message.count({ where: { conversationId: conversation.id, senderType: "AI" } }), 2);
    checks.push("clarification persists into history; later handover is atomic and suppresses additional AI delivery");
  } finally {
    global.fetch = originalFetch;
    if (oldContextMode === undefined) delete process.env.AI_CONTEXT_MODE;
    else process.env.AI_CONTEXT_MODE = oldContextMode;
    if (channel) {
      const conversations = await prisma.conversation.findMany({ where: { channelId: channel.id }, select: { id: true } });
      const scope = { conversationId: { in: conversations.map(item => item.id) } };
      await prisma.aiActionLog.deleteMany({ where: scope });
      await prisma.guardrailEvent.deleteMany({ where: scope });
      await prisma.channel.delete({ where: { id: channel.id } });
      if (createdPlatform && !(await prisma.channel.count({ where: { platformId: channel.platformId } }))) {
        await prisma.platform.delete({ where: { id: channel.platformId } });
      }
    }
  }
}

async function main() {
  await checkQueries();
  await checkStaticRevision();
  await checkLinePersistence();
  console.log(JSON.stringify({ ok: true, isolated_postgresql: true, checks }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
