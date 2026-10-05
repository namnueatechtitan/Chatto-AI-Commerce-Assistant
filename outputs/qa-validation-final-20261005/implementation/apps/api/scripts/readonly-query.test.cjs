const assert = require("node:assert/strict");
const test = require("node:test");
require("reflect-metadata");
const { compileReadonlyQuery } = require("../dist/modules/internal-ai/readonly-query.compiler");
const { ReadonlyQueryService } = require("../dist/modules/internal-ai/readonly-query.service");
const { InternalAiController } = require("../dist/modules/internal-ai/internal-ai.controller");
const { InternalAiService } = require("../dist/modules/internal-ai/internal-ai.service");
const { AiIntegrationService } = require("../dist/modules/ai-integration/ai-integration.service");
const merchant = "10000000-0000-4000-8000-000000000001";

test("compiler permits catalog filtering, aliases, exact aggregates and bounded results", () => {
  const query = compileReadonlyQuery("SELECT c.name, c.price FROM catalog c WHERE c.color ILIKE '%black%' AND c.price BETWEEN 100 AND 500 AND c.available_qty > 0 ORDER BY c.price ASC LIMIT 500");
  assert.deepEqual(query.columns, ["name", "price"]);
  assert.deepEqual(query.parameters, ["%black%", 100, 500, 0]);
  assert.match(query.sql, /LIMIT 51$/);
  assert.match(query.sql, /ILIKE \$2/);
  assert.doesNotMatch(query.sql, /black/);
  const aggregate = compileReadonlyQuery("SELECT category, COUNT(DISTINCT product_id) AS total, AVG(price) AS mean FROM catalog GROUP BY category HAVING COUNT(*) > 1 ORDER BY total DESC");
  assert.match(aggregate.sql, /COUNT\(DISTINCT "product_id"\)/);
  assert.match(aggregate.sql, /ORDER BY COUNT\(DISTINCT "product_id"\) DESC/);
  assert.deepEqual(aggregate.columns, ["category", "count_distinct_product_id", "avg_price"]);
  assert.match(compileReadonlyQuery("SELECT id, title FROM knowledge WHERE type IN ('faq', 'shipping_policy') LIMIT 5").sql, /LIMIT 5$/);
  assert.match(compileReadonlyQuery("SELECT * FROM catalog WHERE available_qty IS NULL").sql, /"available_qty" IS NULL/);
  assert.match(compileReadonlyQuery("SELECT product_id FROM catalog WHERE product_id IN ('10000000-0000-4000-8000-000000000001')").sql, /"product_id" IN \(\$2\)/);
  assert.match(compileReadonlyQuery("SELECT id FROM knowledge WHERE id NOT IN ('10000000-0000-4000-8000-000000000001')").sql, /"id" NOT IN \(\$2\)/);
  assert.match(compileReadonlyQuery("SELECT price AS price FROM catalog").sql, /"price" AS "price"/);
});

test("aggregate labels come from validated operations instead of model aliases", () => {
  const prices = compileReadonlyQuery("SELECT SUM(price) AS total_units, AVG(DISTINCT price) AS odd_label FROM catalog GROUP BY currency HAVING total_units > 1 ORDER BY odd_label DESC");
  assert.deepEqual(prices.columns, ["sum_price", "avg_distinct_price"]);
  assert.match(prices.sql, /SUM\("price"\) AS "sum_price"/);
  assert.match(prices.sql, /HAVING \(SUM\("price"\) > \$2\)/);
  assert.match(prices.sql, /ORDER BY AVG\(DISTINCT "price"\) DESC/);
  assert.doesNotMatch(prices.sql, /total_units|odd_label/);
  assert.deepEqual(compileReadonlyQuery("SELECT COUNT(*) AS products FROM catalog").columns, ["count_catalog_rows"]);
  assert.deepEqual(compileReadonlyQuery("SELECT COUNT(*) AS products FROM knowledge").columns, ["count_knowledge_rows"]);
  assert.deepEqual(compileReadonlyQuery("SELECT COUNT(price), SUM(DISTINCT available_qty) FROM catalog").columns, ["count_price", "sum_distinct_available_qty"]);
  assert.throws(() => compileReadonlyQuery("SELECT MIN(price) AS same, MAX(price) AS same FROM catalog"), /INVALID_READONLY_QUERY/);
});

test("compiler rejects writes, private tables, schemas, tenant filters, execution functions and hidden expressions", () => {
  const attacks = [
    "DELETE FROM products", "UPDATE catalog SET price = 1", "INSERT INTO catalog VALUES ('x')", "DROP TABLE products",
    "SELECT name FROM catalog; DELETE FROM products", "WITH catalog AS (SELECT * FROM users) SELECT * FROM catalog",
    "SELECT * FROM users", "SELECT * FROM products", "SELECT * FROM pg_catalog.pg_authid", "SELECT * FROM public.catalog",
    "SELECT merchant_id FROM catalog", "SELECT name FROM catalog WHERE merchant_id = 'other'", "SELECT name FROM catalog WHERE catalog.xmin = 1",
    "SELECT pg_sleep(10) FROM catalog", "SELECT pg_read_file('/etc/passwd') FROM catalog", "SELECT set_config('role', 'admin', false) FROM catalog",
    "SELECT COUNT(*) OVER () FROM catalog", "SELECT SUM(price) FILTER (WHERE price > 0) FROM catalog", "SELECT current_user FROM catalog",
    "SELECT name::regprocedure FROM catalog", "SELECT name FROM catalog WHERE price = (SELECT 1 FROM users)",
    "SELECT name FROM catalog UNION SELECT email FROM users", "SELECT name FROM catalog JOIN knowledge ON true", "SELECT name FROM catalog, knowledge",
    "SELECT name FROM catalog FOR UPDATE", "SELECT name FROM catalog WHERE name = $1", "SELECT name FROM catalog WHERE price = -1e99",
    "SELECT 1 AS verified_price FROM catalog", "SELECT name FROM catalog ORDER BY random()", "SELECT name FROM catalog LIMIT 99999999",
    "SELECT name FROM catalog OFFSET -1", "SELECT count(*) AS n FROM catalog ORDER BY pg_sleep(1)",
    "SELECT price AS available_qty FROM catalog", "SELECT name AS price FROM catalog",
    "SELECT SUM(price) AS available_qty FROM catalog", "SELECT SUM(price) AS price FROM catalog", "SELECT COUNT(*) AS name FROM catalog",
    'SELECT SUM(price) AS "Available_Qty" FROM catalog',
  ];
  for (const sql of attacks) assert.throws(() => compileReadonlyQuery(sql), /INVALID_READONLY_QUERY/, sql);
  const injectedLiteral = compileReadonlyQuery("SELECT title FROM knowledge WHERE title = 'x''; DROP TABLE users; --'");
  assert.deepEqual(injectedLiteral.parameters, ["x'; DROP TABLE users; --"]);
  assert.doesNotMatch(injectedLiteral.sql, /DROP TABLE/);
});

test("query service binds merchant separately, enforces readonly/timeouts and normalizes capped JSON rows", async () => {
  const commands = [];
  let execution;
  const transaction = {
    $executeRawUnsafe: async sql => { commands.push(sql); },
    $queryRawUnsafe: async (sql, ...values) => {
      execution = { sql, values };
      return Array.from({ length: 51 }, (_, n) => ({ name: `Product ${n}`, available_qty: null, count: 4n }));
    },
  };
  const prisma = { merchant: { findUnique: async () => ({ status: "ACTIVE" }) }, $transaction: async (work, options) => {
    assert.deepEqual(options, { timeout: 3000, maxWait: 2000 });
    return work(transaction);
  } };
  const result = await new ReadonlyQueryService(prisma).query(merchant, "SELECT name, available_qty FROM catalog WHERE color = 'black'");
  assert.deepEqual(execution.values, [merchant, "black"]);
  assert.match(execution.sql, /p\.merchant_id = \$1::uuid AND p\.status = 'active'/);
  assert.match(execution.sql, /v\.merchant_id = p\.merchant_id AND v\.status = 'active'/);
  assert.match(execution.sql, /WHEN v\.stock_on_hand IS NULL THEN NULL/);
  assert.match(execution.sql, /p\.id::text AS product_id, v\.id::text AS variant_id/);
  assert.match(execution.sql, /SELECT id::text AS id, type, title, content/);
  assert.match(execution.sql, /WHERE merchant_id = \$1::uuid AND status = 'active'/);
  assert.deepEqual(commands, ["SET TRANSACTION READ ONLY", "SET LOCAL statement_timeout = '2000ms'", "SET LOCAL lock_timeout = '500ms'"]);
  assert.equal(result.rows.length, 50);
  assert.equal(result.truncated, true);
  assert.equal(result.rows[0].available_qty, null);
  assert.equal(result.rows[0].count, 4);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("invalid SQL or merchant never reaches DB and DB errors are sanitized", async () => {
  let touched = false;
  const service = new ReadonlyQueryService({ merchant: { findUnique: async () => ({ status: "ACTIVE" }) }, $transaction: async () => { touched = true; throw new Error("private connection credential"); } });
  await assert.rejects(service.query("x';--", "SELECT name FROM catalog"), /merchant_id UUID/);
  await assert.rejects(service.query(merchant, "SELECT * FROM users"), /INVALID_READONLY_QUERY/);
  assert.equal(touched, false);
  await assert.rejects(service.query(merchant, "SELECT name FROM catalog"), error => error.message === "READONLY_QUERY_FAILED");
});

test("disabled and missing merchants cannot read snapshots or scoped SQL", async () => {
  let data = null;
  let touched = false;
  const prisma = {
    merchant: { findUnique: async () => data },
    product: { findMany: async () => { touched = true; return []; } },
    knowledgeBaseDocument: { findMany: async () => { touched = true; return []; } },
    $transaction: async () => { touched = true; return []; },
  };
  for (const status of [null, "INACTIVE", "SUSPENDED"]) {
    data = status ? { status } : null;
    await assert.rejects(new ReadonlyQueryService(prisma).query(merchant, "SELECT name FROM catalog"), /unavailable/);
    await assert.rejects(new InternalAiService(prisma).exportKnowledgeSnapshot(merchant), /unavailable/);
    assert.equal(touched, false);
  }
});

test("query and indexing endpoints authenticate before doing any work", async () => {
  const calls = [];
  const controller = new InternalAiController({
    exportKnowledgeVersion: async id => { calls.push(id); return { version: "v1" }; },
    exportKnowledgeSnapshot: async id => { calls.push(id); return { products: {}, knowledge_base: {} }; },
  }, { query: async (id, sql) => { calls.push(id); return { rows: [], truncated: false }; } });
  await assert.rejects(controller.query(undefined, { merchant_id: merchant, sql: "SELECT name FROM catalog" }), /Missing internal/);
  await assert.rejects(controller.knowledgeVersion("Bearer wrong", merchant), /Invalid internal/);
  await assert.rejects(controller.knowledgeSnapshot(undefined, merchant), /Missing internal/);
  assert.deepEqual(calls, []);
  const token = `Bearer ${process.env.INTERNAL_SERVICE_TOKEN ?? "dev_internal_service_token"}`;
  await controller.query(token, { merchant_id: merchant, sql: "SELECT name FROM catalog" });
  await controller.knowledgeVersion(token, merchant);
  await controller.knowledgeSnapshot(token, merchant);
  assert.deepEqual(calls, [merchant, merchant, merchant]);
});

test("knowledge version uses an indexed tenant revision lookup instead of scanning the corpus", async () => {
  const revision = { revision: 7n, updatedAt: new Date("2026-10-01T00:00:00Z") };
  const calls = [];
  const service = new InternalAiService({ merchant: { findUnique: async options => {
    calls.push(options);
    return { status: "ACTIVE", knowledgeRevision: revision };
  } } });
  const first = await service.exportKnowledgeVersion(merchant);
  assert.equal(first.version, `${merchant}:7`);
  assert.equal(first.revision, "7");
  revision.updatedAt = new Date("2026-10-02T00:00:00Z");
  assert.equal((await service.exportKnowledgeVersion(merchant)).version, first.version);
  revision.revision += 1n;
  assert.notEqual((await service.exportKnowledgeVersion(merchant)).version, first.version);
  assert.ok(calls.every(query => query.where.id === merchant));
  assert.deepEqual(calls[0].select, { status: true, knowledgeRevision: { select: { revision: true, updatedAt: true } } });
  assert.doesNotThrow(() => JSON.stringify(first));
  await assert.rejects(service.exportKnowledgeVersion(undefined), /merchant_id UUID/);
});

test("knowledge revision starts at zero for a new merchant and rejects missing or disabled tenants", async () => {
  let data = { status: "TRIAL", knowledgeRevision: null };
  const service = new InternalAiService({ merchant: { findUnique: async () => data } });
  assert.equal((await service.exportKnowledgeVersion(merchant)).revision, "0");
  for (const status of ["INACTIVE", "SUSPENDED"]) {
    data = { status, knowledgeRevision: null };
    await assert.rejects(service.exportKnowledgeVersion(merchant), /unavailable/);
  }
  data = null;
  await assert.rejects(service.exportKnowledgeVersion(merchant), /unavailable/);
});

test("product snapshot scopes nested variants and images to the same merchant", async () => {
  let query;
  const service = new InternalAiService({ product: { findMany: async options => { query = options; return []; } } });
  const result = await service.exportProducts(merchant);
  assert.equal(query.where.merchantId, merchant);
  assert.equal(query.include.variants.where.merchantId, merchant);
  assert.equal(query.include.images.where.merchantId, merchant);
  assert.deepEqual(result.products, []);
});

test("legacy inline export preserves unknown stock instead of asserting zero", async () => {
  const product = {
    id: merchant, merchantId: merchant, name: "Unknown stock fixture", status: "ACTIVE", updatedAt: new Date(), images: [],
    variants: [{ id: merchant, productId: merchant, variantName: "Unknown", price: null,
      currency: "THB", stockOnHand: null, stockReserved: null, status: "ACTIVE" }],
  };
  const service = new InternalAiService({ product: { findMany: async () => [product] } });
  const result = await service.exportProducts(merchant);
  assert.equal(result.products[0].variants[0].stock_qty, null);
  assert.equal(result.products[0].variants[0].reserved_qty, 0);
  assert.equal(result.products[0].variants[0].available_qty, null);
});

test("default chat context excludes whole corpus, ignores client context and retains explicit inline compatibility", async () => {
  const prior = process.env.AI_CONTEXT_MODE;
  const calls = [];
  const internal = {
    exportMerchantSettings: async () => ({ merchant_id: merchant }),
    exportConversationHistory: async () => [],
    exportProducts: async () => { calls.push("products"); return { products: [] }; },
    exportKnowledgeBase: async () => { calls.push("knowledge"); return { knowledge_base: [] }; },
    exportVectorDocuments: async () => { calls.push("vectors"); return []; },
  };
  const service = new AiIntegrationService(internal, {});
  const request = { merchant_id: merchant, conversation_id: "conversation", message: { id: "message" }, ai_context: { products: { private: "client-supplied" } } };
  try {
    delete process.env.AI_CONTEXT_MODE;
    const lean = await service.withMerchantContext(request);
    assert.deepEqual(Object.keys(lean.ai_context).sort(), ["conversation_history", "merchant_settings"]);
    assert.equal(lean.ai_options.backend_retrieval, true);
    assert.deepEqual(calls, []);
    process.env.AI_CONTEXT_MODE = "inline";
    const inline = await service.withMerchantContext(request);
    assert.equal(inline.ai_options.backend_retrieval, false);
    assert.deepEqual(calls.sort(), ["knowledge", "products", "vectors"]);
    assert.deepEqual(inline.ai_context.products, { products: [] });
  } finally {
    if (prior === undefined) delete process.env.AI_CONTEXT_MODE;
    else process.env.AI_CONTEXT_MODE = prior;
  }
});
