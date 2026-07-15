const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractGeminiText,
} = require("../dist/modules/llm/gemini-client.js");
const { MockAiReplyService } = require("../dist/modules/mock-ai-reply/index.js");
const { RagService } = require("../dist/modules/rag/index.js");
const {
  chunkKnowledgeDocuments,
} = require("../dist/modules/rag/document-chunker.js");
const {
  cosineSimilarity,
  scoreLexicalSimilarity,
} = require("../dist/modules/rag/index.js");
const { IntentClassifier } = require("../dist/modules/intent-classifier/index.js");

test("extractGeminiText reads the current Interactions model_output shape", () => {
  const text = extractGeminiText({
    status: "completed",
    steps: [
      { type: "thought", content: [{ type: "text", text: "private reasoning" }] },
      {
        type: "model_output",
        content: [{ type: "output_text", text: "สวัสดีครับ" }],
      },
    ],
  });

  assert.equal(text, "สวัสดีครับ");
});

test("RAG excludes other merchants and irrelevant context for small talk", () => {
  const documents = [
    document("merchant-a", "product", "Product: Tote bag."),
    document("merchant-b", "product", "สวัสดี special product"),
  ];
  const rag = new RagService();

  assert.deepEqual(
    rag.retrieve({
      merchant_id: "merchant-a",
      intent: "small_talk",
      query: "สวัสดี",
      documents,
    }).chunks,
    [],
  );
});

test("RAG selects merchant product data for a Thai product question", () => {
  const rag = new RagService();
  const result = rag.retrieve({
    merchant_id: "merchant-a",
    intent: "product_question",
    query: "มีสินค้าอะไรบ้าง",
    documents: [
      document("merchant-a", "product", "Product: Tote bag."),
      document("merchant-a", "shipping_policy", "Shipping in two days."),
      document("merchant-b", "product", "Product: Other merchant item."),
    ],
  });

  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0].source_type, "product");
  assert.equal(result.chunks[0].chunk_text, "Product: Tote bag.");
});

test("chunking is deterministic, bounded, and preserves overlap metadata", () => {
  const source = {
    merchant_id: "merchant-a",
    source_type: "faq",
    source_id: "faq-1",
    title: "Returns",
    content: "First sentence explains returns. Second sentence has more detail. Third sentence closes the policy.",
    metadata: {},
  };
  const first = chunkKnowledgeDocuments([source], {
    maxCharacters: 48,
    overlapCharacters: 12,
  });
  const second = chunkKnowledgeDocuments([source], {
    maxCharacters: 48,
    overlapCharacters: 12,
  });

  assert.ok(first.length > 1);
  assert.deepEqual(first, second);
  assert.match(first[0].id, /^[0-9a-f-]{36}$/);
  assert.equal(first[0].metadata.chunk_count, first.length);
  assert.equal(first[0].metadata.managed_by, "chatto-live-chunker");
  assert.equal(first[1].metadata.chunk_index, 1);
  assert.ok(first[1].chunk_text.length <= 60);
});

test("hybrid RAG ranks semantic similarity ahead of unrelated chunks", () => {
  const rag = new RagService();
  const matching = {
    ...document("merchant-a", "product", "Canvas shoulder bag"),
    source_id: "matching",
    embedding: [1, 0, 0],
  };
  const unrelated = {
    ...document("merchant-a", "product", "Ceramic coffee cup"),
    source_id: "unrelated",
    embedding: [0, 1, 0],
  };
  const result = rag.retrieve({
    merchant_id: "merchant-a",
    intent: "product_question",
    query: "Which bag should I buy?",
    query_embedding: [1, 0, 0],
    documents: [unrelated, matching],
  });

  assert.equal(result.mode, "hybrid_semantic");
  assert.equal(result.chunks[0].source_id, "matching");
  assert.ok(result.chunks[0].semantic_score > result.chunks[1].semantic_score);
});

test("cosine and multilingual lexical scoring expose stable primitives", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(scoreLexicalSimilarity("ส่งกี่วัน", "จัดส่งภายใน 2 วัน") > 0);
});

test("Thai small talk fallback never dumps product or policy context", () => {
  const service = new MockAiReplyService();
  const reply = service.generateReply({
    intent: "small_talk",
    confidence: 0.8,
    language: "th",
    retrievedChunks: [
      {
        source_type: "product",
        source_id: "product-1",
        title: "Tote bag",
        chunk_text: "Product: Tote bag. Price: 390 THB.",
        score: 1,
        metadata: {},
      },
    ],
  });

  assert.match(reply.reply, /สวัสดี/);
  assert.doesNotMatch(reply.reply, /390|Tote bag|Shipping/i);
});

test("Thai greetings, language requests, and product questions are classified", () => {
  const classifier = new IntentClassifier();

  assert.equal(classifier.classify("สวัสดี").intent, "small_talk");
  assert.equal(classifier.classify("กรุณาพูดไทย").intent, "language_preference");
  assert.equal(classifier.classify("มีสินค้าอะไรบ้าง").intent, "product_question");
  assert.equal(
    classifier.classify("How much is the tote bag and which variant is available?").intent,
    "product_question",
  );
  assert.notEqual(classifier.classify("which option?").intent, "small_talk");
});

test("Thai product fallback uses only the retrieved DB product in Thai", () => {
  const service = new MockAiReplyService();
  const reply = service.generateReply({
    intent: "product_question",
    confidence: 0.82,
    language: "th",
    retrievedChunks: [
      {
        source_type: "product",
        source_id: "product-1",
        title: "Chatto Starter Tote Bag",
        chunk_text:
          "Product: Chatto Starter Tote Bag. Price: 390 THB. Variant: Natural / Medium. Available quantity: 25.",
        score: 0.6,
        metadata: {},
      },
    ],
  });

  assert.match(reply.reply, /สินค้า Chatto Starter Tote Bag/);
  assert.match(reply.reply, /ราคา 390 THB/);
  assert.match(reply.reply, /25 ชิ้น/);
  assert.doesNotMatch(reply.reply, /Sure|Shipping|Payment/i);
});

function document(merchantId, sourceType, text) {
  return {
    merchant_id: merchantId,
    source_type: sourceType,
    source_id: `${merchantId}-${sourceType}`,
    chunk_text: text,
    metadata: { title: text },
    status: "active",
  };
}
