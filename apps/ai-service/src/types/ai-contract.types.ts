export type ChattoChannel = "line" | "web_chat" | "messenger";

export type AiIntent =
  | "product_search"
  | "product_question"
  | "recommendation"
  | "shipping_question"
  | "payment_question"
  | "return_question"
  | "language_preference"
  | "small_talk"
  | "unknown";

export type AiSourceType =
  | "product"
  | "product_variant"
  | "knowledge_base"
  | "faq"
  | "shipping_policy"
  | "payment_policy"
  | "return_policy"
  | "store_info"
  | "custom";

export interface AiChatRequest {
  request_id: string;
  merchant_id: string;
  channel: ChattoChannel;
  conversation_id: string;
  customer: {
    id: string;
    display_name?: string;
  };
  message: {
    id: string;
    text: string;
    timestamp: string;
  };
  ai_options?: {
    language?: string;
    top_k?: number;
  };
  ai_context?: AiContextForRequest;
}

export interface AiChatResponse {
  request_id: string;
  merchant_id: string;
  conversation_id: string;
  intent: AiIntent | string;
  reply: {
    text: string;
    confidence: number;
  };
  sources?: Array<{
    source_type: AiSourceType | string;
    source_id: string;
    title: string;
  }>;
  generation?: {
    provider: "mock" | "gemini" | "openai" | string;
    model: string | null;
    used_external_provider: boolean;
    fallback_used: boolean;
    fallback_reason?: string;
    latency_ms: number;
    timed_out?: boolean;
  };
  actions?: Array<Record<string, unknown>>;
  handover_required: boolean;
  mcp?: {
    server: string;
    resources_used: McpResourceName[];
    tools_called: McpToolName[];
  };
}

export interface ProductVariantForAi {
  id: string;
  product_id: string;
  variant_name: string;
  sku?: string;
  color?: string;
  size?: string;
  price: number | null;
  currency: string;
  stock_qty: number;
  reserved_qty: number;
  available_qty: number;
  low_stock_threshold?: number | null;
  status: string;
}

export interface ProductForAi {
  id: string;
  merchant_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;

  /**
   * Your Product model has no direct price.
   * Backend calculates this from active variants.
   */
  price: number | null;
  currency: string;

  image_urls: string[];
  status: string;
  variants: ProductVariantForAi[];
  updated_at: string;
}

export interface ProductExportResponse {
  merchant_id: string;
  products: ProductForAi[];
}

export interface KnowledgeBaseItemForAi {
  id: string;
  merchant_id: string;
  type:
    | "faq"
    | "shipping_policy"
    | "payment_policy"
    | "return_policy"
    | "store_info"
    | "custom"
    | string;
  title: string;
  content: string;
  status: string;
  updated_at: string;
}

export interface KnowledgeBaseExportResponse {
  merchant_id: string;
  knowledge_base: KnowledgeBaseItemForAi[];
}

export interface MerchantSettingsForAi {
  merchant_id: string;
  store_name: string;
  bot_name: string;
  default_language: string;
  ai_tone: string;
  rules: string[];
  enabled_features: {
    product_qa: boolean;
    recommendation: boolean;
    checkout: boolean;
    memory: boolean;
    human_handover: boolean;
    [key: string]: boolean;
  };
}

export interface AiKnowledgeDocument {
  merchant_id: string;
  source_type: AiSourceType | string;
  source_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface VectorDocumentForAi {
  id?: string;
  merchant_id: string;
  source_type: string;
  source_id: string;
  chunk_text: string;
  embedding?: number[] | null;
  metadata?: Record<string, unknown> | null;
  status: string;
}

export interface AiContextForRequest {
  merchant_settings?: MerchantSettingsForAi;
  products?: ProductExportResponse;
  knowledge_base?: KnowledgeBaseExportResponse;
  vector_documents?: VectorDocumentForAi[];
  conversation_history?: AiConversationMessage[];
}

export interface AiConversationMessage {
  sender_type: "customer" | "ai" | "human" | string;
  content: string;
  created_at: string;
}

export interface VectorDocumentRowForAi {
  id: string;
  merchantId: string;
  sourceType: string;
  sourceId: string;
  chunkText: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  status: "ACTIVE" | "INACTIVE";
}

export type McpResourceName =
  | "merchant_profile"
  | "channel_configuration"
  | "conversation_history"
  | "knowledge_documents"
  | "vector_documents"
  | "customer_memory"
  | "guardrail_policy"
  | "handover_policy";

export type McpToolName =
  | "chatto.classify_intent"
  | "chatto.build_context"
  | "chatto.retrieve_knowledge"
  | "chatto.load_customer_memory"
  | "chatto.evaluate_guardrails"
  | "chatto.draft_mock_reply"
  | "chatto.evaluate_reply"
  | "chatto.create_embedding";

export interface McpResourceDescriptor {
  name: McpResourceName;
  uri_template: string;
  description: string;
  phase: "phase-2";
}

export interface McpToolDescriptor {
  name: McpToolName;
  description: string;
  read_only: boolean;
  phase: "phase-2";
}

export interface McpManifest {
  name: "chatto-phase-2-mcp";
  version: string;
  phase: "phase-2";
  transport: "http-json";
  resources: McpResourceDescriptor[];
  tools: McpToolDescriptor[];
}

export interface McpToolCall {
  name: McpToolName;
  input: Record<string, unknown>;
}

export interface McpToolResult<TOutput = unknown> {
  name: McpToolName;
  ok: boolean;
  output?: TOutput;
  error?: string;
}

export interface RagRetrieveRequest {
  merchant_id?: string;
  intent?: string;
  query?: string;
  query_embedding?: number[];
  top_k?: number;
  documents?: VectorDocumentForAi[];
}

export interface RagRetrievedChunk {
  source_type: string;
  source_id: string;
  title: string;
  chunk_text: string;
  score: number;
  semantic_score?: number;
  lexical_score: number;
  intent_score: number;
  metadata: Record<string, unknown>;
}

export interface RagRetrieveResult {
  mode: "hybrid_semantic" | "hybrid_lexical_fallback";
  query: string;
  top_k: number;
  chunks: RagRetrievedChunk[];
}
