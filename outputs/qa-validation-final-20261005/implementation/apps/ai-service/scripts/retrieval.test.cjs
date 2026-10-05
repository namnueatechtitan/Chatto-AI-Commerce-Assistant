const assert = require("node:assert/strict");
const test = require("node:test");
process.env.AI_EMBEDDING_PROVIDER = "none";
const { EmbeddingsService, normalizeVector } = require("../dist/modules/embeddings");
const { Bm25Index, tokenize, retrieveDocuments, reciprocalRankFusion, KnowledgeIndex } = require("../dist/modules/retrieval");
const { RagService, cosineSimilarity } = require("../dist/modules/rag");
const { buildProductKnowledgeDocument, toVectorDocumentRows } = require("../dist/modules/rag/vector-document.builder");
const row = (id, text, embedding, merchant = "store-a") => ({ id, merchant_id: merchant, source_type: "product", source_id: id,
  chunk_text: text, embedding, status: "active", metadata: { title: id } });

test("Thai ICU tokenization finds words inside unspaced customer questions", () => {
  const tokens = tokenize("รองเท้าวิ่งสีแดง SKU-RED-01");
  assert.ok(tokens.includes("รองเท้า"));
  assert.ok(tokens.includes("sku-red-01"));
  const corpus = new Bm25Index(["กระเป๋าสะพายสีดำ", "รองเท้าวิ่งสีแดง"]);
  assert.equal(corpus.search("รองเท้าวิ่ง")[0].index, 1);
});
test("BM25 weights a rare term and applies document length normalization", () => {
  const corpus = new Bm25Index(["cotton cotton cotton", "cotton scarlet", "cotton ".repeat(30) + "scarlet"]);
  const hits = corpus.search("scarlet");
  assert.deepEqual(hits.map(hit => hit.index), [1, 2]);
  assert.ok(hits[0].score > hits[1].score);
  assert.equal(hits[0].coverage, 1);
});
test("SKU boundaries reject a similar identifier and exact matching reranks candidates", () => {
  const docs = [row("wrong", "SKU: BAG-RED-02. Red travel bag.", [1, 0]), row("right", "SKU: BAG-RED-01. Red travel bag.", [0.8, 0.2])];
  const result = retrieveDocuments("BAG-RED-01", docs, [1, 0], { mode: "hybrid_rerank", merchantId: "store-a" });
  assert.equal(result[0].source_id, "right");
  assert.equal(result[0].metadata.exact_entity_score, 1);
  assert.equal(result[1].metadata.exact_entity_score, 0);
});
test("dense and BM25 modes produce distinct controlled baselines", () => {
  const docs = [row("strawberry", "Fresh strawberry", [1, 0]), row("apple", "Fresh apple", [0, 1])];
  assert.equal(retrieveDocuments("apple", docs, [1, 0], { mode: "dense" })[0].source_id, "strawberry");
  assert.equal(retrieveDocuments("apple", docs, [1, 0], { mode: "bm25" })[0].source_id, "apple");
  const reranked = retrieveDocuments("apple", docs, [1, 0], { mode: "hybrid_rerank" });
  assert.equal(reranked[0].source_id, "apple");
  assert.equal(reranked[0].metadata.reranker, "deterministic-entity-coverage-v1");
});
test("RRF merges rank positions and never interprets raw BM25 as a probability", () => {
  const scores = reciprocalRankFusion([[0, 1], [1, 2]]);
  assert.ok(scores.get(1) > scores.get(0));
  assert.equal(reciprocalRankFusion([[0, 0]]).get(0), 1 / 61);
  assert.throws(() => reciprocalRankFusion([], -1));
});
test("tenant and inactive filtering occurs before corpus statistics and ranking", () => {
  const docs = [row("own", "apple", [0.8, 0.2]), row("other", "apple", [1, 0], "store-b"), { ...row("inactive", "apple", [1, 0]), status: "inactive" }];
  assert.deepEqual(retrieveDocuments("apple", docs, [1, 0], { merchantId: "store-a" }).map(chunk => chunk.source_id), ["own"]);
  assert.throws(() => retrieveDocuments("apple", docs, [1, 0]), /MERCHANT_SCOPE_REQUIRED/);
});
test("no intent-only evidence and dense mode has no silent lexical fallback", () => {
  const docs = [row("bag", "Cotton bag", undefined)];
  assert.deepEqual(retrieveDocuments("spaceship", docs, undefined, { intent: "product_question" }), []);
  assert.deepEqual(retrieveDocuments("bag", docs, undefined, { mode: "dense" }), []);
  assert.deepEqual(new RagService().retrieve({ query: "hello", intent: "small_talk", documents: docs }).chunks, []);
});
test("corpus cache invalidates edited text and candidate work stays bounded", () => {
  const docs = Array.from({ length: 100 }, (_, index) => row(`bag-${index}`, "red cotton bag", [1, 0]));
  const result = retrieveDocuments("bag", docs, [1, 0], { mode: "hybrid_rerank", topK: 10, candidateLimit: 12 });
  assert.equal(result.length, 10); assert.equal(result[0].metadata.candidate_limit, 12);
  assert.equal(retrieveDocuments("apple", [row("same", "apple")], undefined, { mode: "bm25" }).length, 1);
  assert.equal(retrieveDocuments("apple", [row("same", "banana")], undefined, { mode: "bm25" }).length, 0);
});

const product = { id: "bag", merchant_id: "store-a", name: "Cotton bag", description: "Durable reusable cotton tote", category: "bags", brand: "Chatto",
  price: 390, currency: "THB", image_urls: [], status: "active", updated_at: "2026-10-03T00:00:00Z",
  variants: [{ id: "red", product_id: "bag", variant_name: "Red", color: "red", size: "M", sku: "BAG-RED-M", price: 390, currency: "THB", stock_qty: 10, reserved_qty: 1, available_qty: 9, status: "active" }] };
test("price/stock changes leave static chunk hashes unchanged while description edits change them", () => {
  const initial = toVectorDocumentRows([buildProductKnowledgeDocument(product)]);
  const changed = structuredClone(product); changed.price = 490; changed.updated_at = "2026-10-03T01:00:00Z";
  changed.variants[0].price = 490; changed.variants[0].available_qty = 8; changed.variants[0].stock_qty = 9;
  const after = toVectorDocumentRows([buildProductKnowledgeDocument(changed)]);
  assert.equal(initial[0].chunkText, after[0].chunkText);
  assert.equal(initial[0].metadata.content_hash, after[0].metadata.content_hash);
  assert.doesNotMatch(after[0].chunkText, /Price:|quantity:|390|490/);
  changed.description = "Waterproof nylon tote";
  assert.notEqual(initial[0].metadata.content_hash, toVectorDocumentRows([buildProductKnowledgeDocument(changed)])[0].metadata.content_hash);
});
test("embedding reuse checks title/text/model identity; caches deduplicate requests", async () => {
  let calls = 0;
  const requests = [];
  const fetchImpl = async (url, options) => { calls++; requests.push({ url, body: JSON.parse(options.body) }); return new Response(JSON.stringify({ embeddings: [[1, 2, 3]] })); };
  const service = new EmbeddingsService({ provider: "ollama", dimensions: 3, model: "fixture", baseUrl: "http://local.test", fetchImpl });
  const [left, right] = await Promise.all([service.embedQuery("apple"), service.embedQuery("apple")]);
  assert.equal(calls, 1); left.values[0] = 999; assert.notEqual(right.values[0], 999);
  const first = await service.enrichDocuments([row("apple", "Fresh apple")]);
  const same = await service.enrichDocuments(first.documents); assert.equal(same.reused, 1); assert.equal(calls, 2);
  const changed = await service.enrichDocuments([{ ...first.documents[0], chunk_text: "Fresh banana" }]);
  assert.equal(changed.generated, 1); assert.equal(calls, 3);
  const newModel = new EmbeddingsService({ provider: "ollama", dimensions: 3, model: "fixture-v2", fetchImpl });
  await newModel.enrichDocuments(first.documents); assert.equal(calls, 4);
  assert.equal(requests[0].body.truncate, false); assert.match(requests[0].url, /\/api\/embed$/);
});
test("failed model refresh clears stale vectors and rejects wrong dimensions", async () => {
  const service = new EmbeddingsService({ provider: "ollama", dimensions: 3, fetchImpl: async () => new Response(JSON.stringify({ embeddings: [[1, 2]] })) });
  const result = await service.enrichDocuments([row("apple", "apple", [1, 0, 0])]);
  assert.equal(result.documents[0].embedding, null); assert.equal(result.errors.length, 1);
  assert.throws(() => normalizeVector([0, 0])); assert.equal(cosineSimilarity([NaN, 0], [1, 0]), 0);
});
test("snapshot refresh deduplicates, removes obsolete data and survives failure atomically", async () => {
  const index = new KnowledgeIndex({ maxMerchants: 2 }); let calls = 0;
  const loader = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return [row("old", "apple")]; };
  const [first, second] = await Promise.all([index.refresh("store-a", loader), index.refresh("store-a", loader)]);
  assert.equal(calls, 1); assert.equal(first.version, second.version);
  first.documents[0].chunk_text = "mutated"; assert.equal(index.getDocuments("store-a")[0].chunk_text, "apple");
  await assert.rejects(index.refresh("store-a", async () => { throw new Error("offline"); }));
  assert.equal(index.getDocuments("store-a")[0].source_id, "old");
  await index.refresh("store-a", async () => [row("new", "banana")]);
  assert.deepEqual(index.getDocuments("store-a").map(document => document.source_id), ["new"]);
  await assert.rejects(index.refresh("store-a", async () => [row("bad", "apple", undefined, "store-b")]), /MERCHANT_SCOPE_MISMATCH/);
  await index.refresh("store-b", async () => []); await index.refresh("store-c", async () => []);
  assert.equal(index.getSnapshot("store-a"), undefined);
});
