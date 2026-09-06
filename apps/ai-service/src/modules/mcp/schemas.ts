import { z } from "zod";
import type { AiContextForRequest } from "../../types/ai-contract.types";

export const idSchema = z.string().trim().min(1).max(255);
export const textSchema = z.string().max(12000);
const metadata = z.record(z.string(), z.unknown());
const score = z.number().finite().min(0).max(1);
const embedding = z.array(z.number().finite()).min(1).max(4096);
export const settingsSchema = z.object({
  merchant_id: idSchema, store_name: z.string().max(255), bot_name: z.string().max(100),
  default_language: z.string().max(20), ai_tone: z.string().max(100),
  handover_threshold: z.number().positive().max(1).optional(),
  rules: z.array(textSchema).max(100),
  enabled_features: z.object({
    product_qa: z.boolean(), recommendation: z.boolean(), checkout: z.boolean(),
    memory: z.boolean(), human_handover: z.boolean(),
  }).catchall(z.boolean()),
});
const variantSchema = z.object({
  id: idSchema, product_id: idSchema, variant_name: z.string(),
  sku: z.string().optional(), color: z.string().optional(), size: z.string().optional(),
  price: z.number().finite().nullable(), currency: z.string(),
  stock_qty: z.number().finite(), reserved_qty: z.number().finite(), available_qty: z.number().finite(),
  low_stock_threshold: z.number().finite().nullable().optional(), status: z.string(),
});
const productSchema = z.object({
  id: idSchema, merchant_id: idSchema, name: z.string(),
  description: textSchema.nullable().optional(), category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(), price: z.number().finite().nullable(),
  currency: z.string(), image_urls: z.array(z.string()), status: z.string(),
  variants: z.array(variantSchema).max(500), updated_at: z.string(),
});
const knowledgeSchema = z.object({
  id: idSchema, merchant_id: idSchema, type: z.string(), title: z.string(),
  content: z.string().max(200000), status: z.string(), updated_at: z.string(),
});
export const vectorSchema = z.object({
  id: idSchema.optional(), merchant_id: idSchema, source_type: idSchema, source_id: idSchema,
  chunk_text: textSchema, embedding: embedding.nullable().optional(),
  metadata: metadata.nullable().optional(), status: z.string(),
});
export const chunkSchema = z.object({
  source_type: idSchema, source_id: idSchema, title: z.string(), chunk_text: textSchema,
  score, semantic_score: score.optional(), lexical_score: score, intent_score: score,
  metadata,
});
export const chunksSchema = z.array(chunkSchema).max(10);
export const contextSchema = z.object({
  merchant_settings: settingsSchema.optional(),
  products: z.object({ merchant_id: idSchema, products: z.array(productSchema).max(1000) }).optional(),
  knowledge_base: z.object({ merchant_id: idSchema, knowledge_base: z.array(knowledgeSchema).max(1000) }).optional(),
  vector_documents: z.array(vectorSchema).max(5000).optional(),
  conversation_history: z.array(z.object({
    sender_type: z.string(), content: textSchema, created_at: z.string(),
  })).max(50).optional(),
});
export const chatSchema = z.object({
  request_id: idSchema, merchant_id: idSchema,
  channel: z.enum(["line", "web_chat", "messenger"]), conversation_id: idSchema,
  customer: z.object({ id: idSchema, display_name: z.string().max(255).optional() }),
  message: z.object({ id: idSchema, text: z.string().trim().min(1).max(5000), timestamp: z.iso.datetime({ offset: true }) }),
  ai_options: z.object({ language: z.string().max(20).optional(), top_k: z.number().int().min(1).max(10).optional() }).optional(),
  ai_context: contextSchema.optional(),
});

/** Validate every row BEFORE it is embedded, synced, retrieved, or sent to an LLM. */
export function assertMerchantContext(merchantId: string, context?: AiContextForRequest): void {
  if (!context) return;
  const ids = [context.merchant_settings?.merchant_id, context.products?.merchant_id,
    context.knowledge_base?.merchant_id,
    ...(context.products?.products ?? []).map(row => row.merchant_id),
    ...(context.knowledge_base?.knowledge_base ?? []).map(row => row.merchant_id),
    ...(context.vector_documents ?? []).map(row => row.merchant_id)];
  if (ids.some(id => id !== undefined && id !== merchantId)) throw new Error("MERCHANT_SCOPE_MISMATCH");
  for (const product of context.products?.products ?? []) {
    if (product.variants.some(variant => variant.product_id !== product.id)) throw new Error("PRODUCT_SCOPE_MISMATCH");
  }
}

export const toolSchemas = {
  "chatto.classify_intent": z.object({ message: textSchema }),
  "chatto.build_context": z.object({ merchant_id: idSchema, message: textSchema, ai_context: contextSchema.optional() }),
  "chatto.retrieve_knowledge": z.object({
    merchant_id: idSchema, intent: idSchema, query: textSchema,
    query_embedding: embedding.optional(), top_k: z.number().int().min(1).max(10).optional(),
    documents: z.array(vectorSchema).max(5000),
  }),
  "chatto.load_customer_memory": z.object({ customer_id: idSchema }),
  "chatto.evaluate_guardrails": z.object({ message: textSchema }),
  "chatto.draft_mock_reply": z.object({
    intent: idSchema, confidence: score, language: z.string().optional(),
    retrievedChunks: chunksSchema.optional(), merchantSettings: settingsSchema.optional(),
  }),
  "chatto.evaluate_reply": z.object({ reply: textSchema, intent: idSchema, confidence: score, needs_handover: z.boolean() }),
  "chatto.create_embedding": z.object({ text: textSchema.min(1) }),
  "chatto.calculate_confidence": z.object({
    intent: idSchema, intent_confidence: score, chunks: chunksSchema,
    threshold: z.number().positive().max(1).optional(), blocked: z.boolean().optional(), force_handover: z.boolean().optional(),
  }),
  "chatto.validate_output": z.object({ reply: z.string(), chunks: chunksSchema, requires_evidence: z.boolean() }),
};
