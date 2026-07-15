const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractGeminiText,
} = require("../dist/modules/llm/gemini-client.js");
const { MockAiReplyService } = require("../dist/modules/mock-ai-reply/index.js");
const { RagService } = require("../dist/modules/rag/index.js");
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
