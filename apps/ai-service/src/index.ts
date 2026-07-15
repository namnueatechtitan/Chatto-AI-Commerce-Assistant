import cors from "cors";
import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";

import { ContextBuilder } from "./modules/context-builder";
import { EmbeddingsService } from "./modules/embeddings";
import { EvaluationService } from "./modules/evaluation";
import { GuardrailService } from "./modules/guardrails";
import { IntentClassifier } from "./modules/intent-classifier";
import { LlmReplyService } from "./modules/llm";
import { MemoryService } from "./modules/memory";
import { MockAiReplyService } from "./modules/mock-ai-reply";
import { OpenAiClientStub } from "./modules/openai-client";
import { PromptManager } from "./modules/prompt-manager";
import { RagService } from "./modules/rag";
import { VectorStoreClient } from "./modules/vector-store";
import {
  buildKnowledgeBaseDocuments,
  buildProductKnowledgeDocuments,
  toVectorDocumentRows,
} from "./modules/rag/vector-document.builder";
import type {
  AiContextForRequest,
  AiChatRequest,
  AiChatResponse,
  McpManifest,
  McpResourceDescriptor,
  McpToolCall,
  McpToolDescriptor,
  McpToolName,
  McpToolResult,
  RagRetrieveResult,
  VectorDocumentForAi,
} from "./types/ai-contract.types";


function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");

  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = /^([\w.-]+)\s*=\s*(.*)$/.exec(line);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripEnvQuotes(rawValue);
  }
}

function stripEnvQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

loadEnvFile(path.resolve(process.cwd(), "../../.env"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const app = express();
const port = Number(process.env.AI_SERVICE_PORT ?? 5000);

const openAiClient = new OpenAiClientStub();
const promptManager = new PromptManager();
const intentClassifier = new IntentClassifier();
const contextBuilder = new ContextBuilder();
const ragService = new RagService();
const embeddingsService = new EmbeddingsService();
const memoryService = new MemoryService();
const guardrailService = new GuardrailService();
const evaluationService = new EvaluationService();
const mockAiReplyService = new MockAiReplyService();
const llmReplyService = new LlmReplyService();
const vectorStoreClient = new VectorStoreClient();

const mcpResources: McpResourceDescriptor[] = [
  {
    name: "merchant_profile",
    uri_template: "chatto://merchants/{merchant_id}",
    description: "Merchant settings available to the Phase 2 AI pipeline.",
    phase: "phase-2",
  },
  {
    name: "channel_configuration",
    uri_template: "chatto://merchants/{merchant_id}/channels/{channel}",
    description: "Channel metadata for message intake and reply context.",
    phase: "phase-2",
  },
  {
    name: "conversation_history",
    uri_template: "chatto://conversations/{conversation_id}/messages",
    description: "Recent conversation history supplied to the AI pipeline.",
    phase: "phase-2",
  },
  {
    name: "knowledge_documents",
    uri_template: "chatto://merchants/{merchant_id}/knowledge-base",
    description: "FAQ and merchant knowledge exported for AI context.",
    phase: "phase-2",
  },
  {
    name: "vector_documents",
    uri_template: "chatto://merchants/{merchant_id}/vector-documents",
    description: "Chunked Phase 2 documents with reusable Gemini embeddings.",
    phase: "phase-2",
  },
  {
    name: "customer_memory",
    uri_template: "chatto://customers/{customer_id}/memory",
    description: "Customer memory scaffold for later summarization.",
    phase: "phase-2",
  },
  {
    name: "guardrail_policy",
    uri_template: "chatto://ai/guardrails/default",
    description: "Mock guardrail policy used before drafting replies.",
    phase: "phase-2",
  },
  {
    name: "handover_policy",
    uri_template: "chatto://handover/policy/default",
    description: "Human handover decision scaffold.",
    phase: "phase-2",
  },
];

const mcpTools: McpToolDescriptor[] = [
  {
    name: "chatto.classify_intent",
    description: "Classify a message with the Phase 2 mock classifier.",
    read_only: true,
    phase: "phase-2",
  },
  {
    name: "chatto.build_context",
    description: "Build merchant-scoped context from supplied MCP resources.",
    read_only: true,
    phase: "phase-2",
  },
  {
    name: "chatto.retrieve_knowledge",
    description: "Run merchant-scoped hybrid semantic and lexical retrieval.",
    read_only: true,
    phase: "phase-2",
  },
  {
    name: "chatto.load_customer_memory",
    description: "Load customer memory placeholders.",
    read_only: true,
    phase: "phase-2",
  },
  {
    name: "chatto.evaluate_guardrails",
    description: "Evaluate the incoming message with mock guardrails.",
    read_only: true,
    phase: "phase-2",
  },
  {
    name: "chatto.draft_mock_reply",
    description: "Draft the Phase 2 mock AI reply.",
    read_only: true,
    phase: "phase-2",
  },
  {
    name: "chatto.evaluate_reply",
    description: "Evaluate the mock reply using the placeholder evaluator.",
    read_only: true,
    phase: "phase-2",
  },
  {
    name: "chatto.create_embedding",
    description: "Create a Gemini retrieval embedding for supplied text.",
    read_only: true,
    phase: "phase-2",
  },
];

const mcpManifest: McpManifest = {
  name: "chatto-phase-2-mcp",
  version: "0.2.0",
  phase: "phase-2",
  transport: "http-json",
  resources: mcpResources,
  tools: mcpTools,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value : "";
}

function getOptionalNumber(
  input: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = input[key];
  return typeof value === "number" ? value : undefined;
}

function getOptionalNumberArray(
  input: Record<string, unknown>,
  key: string,
): number[] | undefined {
  const value = input[key];

  return Array.isArray(value) && value.every((item) => typeof item === "number")
    ? value
    : undefined;
}

function resolveReplyLanguage(
  message: string,
  requestedLanguage: string | undefined,
): string {
  if (/[\u0E00-\u0E7F]/u.test(message)) {
    return "th";
  }

  return requestedLanguage?.trim().toLowerCase() || "en";
}

function getAiContext(input: Record<string, unknown>): AiContextForRequest | undefined {
  const value = input.ai_context;
  return isRecord(value) ? (value as AiContextForRequest) : undefined;
}

function buildVectorDocumentsFromContext(
  aiContext: AiContextForRequest | undefined,
): VectorDocumentForAi[] {
  if (!aiContext) {
    return [];
  }

  const productDocuments = aiContext.products
    ? buildProductKnowledgeDocuments(aiContext.products)
    : [];
  const knowledgeDocuments = aiContext.knowledge_base
    ? buildKnowledgeBaseDocuments(aiContext.knowledge_base)
    : [];

  const liveDocuments = toVectorDocumentRows([
    ...productDocuments,
    ...knowledgeDocuments,
  ]).map(
    (row) => ({
      id: row.id,
      merchant_id: row.merchantId,
      source_type: row.sourceType,
      source_id: row.sourceId,
      chunk_text: row.chunkText,
      embedding: row.embedding,
      metadata: row.metadata,
      status: row.status,
    }),
  );

  const storedById = new Map(
    (aiContext.vector_documents ?? [])
      .filter((document) => Boolean(document.id))
      .map((document) => [document.id!, document]),
  );
  const mergedLiveDocuments = liveDocuments.map((document) => {
    const stored = document.id ? storedById.get(document.id) : undefined;
    const contentUnchanged =
      stored?.metadata?.content_hash === document.metadata?.content_hash;

    if (!stored || !contentUnchanged || !Array.isArray(stored.embedding)) {
      return document;
    }

    return {
      ...document,
      embedding: stored.embedding,
      metadata: {
        ...(document.metadata ?? {}),
        embedding_model: stored.metadata?.embedding_model,
        embedding_dimensions: stored.metadata?.embedding_dimensions,
        embedded_at: stored.metadata?.embedded_at,
      },
    };
  });
  const liveIds = new Set(mergedLiveDocuments.map((document) => document.id));
  const additionalStoredDocuments = (aiContext.vector_documents ?? []).filter(
    (document) =>
      document.metadata?.managed_by !== "chatto-live-chunker" &&
      (!document.id || !liveIds.has(document.id)),
  );

  return [...mergedLiveDocuments, ...additionalStoredDocuments];
}

function readMcpResource(
  uri: string,
  aiContext: AiContextForRequest | undefined,
  channel?: string,
): unknown {
  if (uri.includes("/knowledge-base")) {
    return aiContext?.knowledge_base ?? { knowledge_base: [] };
  }

  if (uri.includes("/vector-documents")) {
    return buildVectorDocumentsFromContext(aiContext);
  }

  if (uri.startsWith("chatto://conversations/")) {
    return aiContext?.conversation_history ?? [];
  }

  if (uri.startsWith("chatto://merchants/") && uri.includes("/channels/")) {
    return { channel: channel ?? uri.split("/channels/")[1] ?? "unknown" };
  }

  if (uri.startsWith("chatto://merchants/")) {
    return aiContext?.merchant_settings ?? {};
  }

  if (uri.startsWith("chatto://customers/")) {
    return { memories: memoryService.loadCustomerMemories() };
  }

  if (uri === "chatto://ai/guardrails/default") {
    return { policy: "phase-2-safe-reply", commerce_actions_allowed: false };
  }

  if (uri === "chatto://handover/policy/default") {
    return { handover_on_low_confidence: true, threshold: 0.5 };
  }

  throw new Error(`Unknown MCP resource URI: ${uri}`);
}

function hasValidServiceToken(request: Request): boolean {
  const expectedToken =
    process.env.AI_SERVICE_TOKEN ?? "dev_internal_service_token";
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  return authorization.replace("Bearer ", "").trim() === expectedToken;
}

function rejectUnauthorized(request: Request, response: Response): void {
  response.status(401).json({
    error: {
      code: "UNAUTHORIZED",
      message: "Missing or invalid AI service token.",
      request_id: request.headers["x-request-id"] ?? "unknown",
    },
  });
}

function isAiChatRequest(body: Partial<AiChatRequest>): body is AiChatRequest {
  return (
    typeof body.request_id === "string" &&
    typeof body.merchant_id === "string" &&
    typeof body.channel === "string" &&
    typeof body.conversation_id === "string" &&
    Boolean(body.customer) &&
    typeof body.customer?.id === "string" &&
    Boolean(body.message) &&
    typeof body.message?.id === "string" &&
    typeof body.message?.text === "string" &&
    typeof body.message?.timestamp === "string"
  );
}

async function callMcpTool(call: McpToolCall): Promise<McpToolResult> {
  switch (call.name) {
    case "chatto.classify_intent":
      return {
        name: call.name,
        ok: true,
        output: intentClassifier.classify(getString(call.input, "message")),
      };
    case "chatto.build_context":
      return {
        name: call.name,
        ok: true,
        output: contextBuilder.buildContext({
          merchantId: getString(call.input, "merchant_id"),
          message: getString(call.input, "message"),
          aiContext: getAiContext(call.input),
        }),
      };
    case "chatto.retrieve_knowledge":
      return {
        name: call.name,
        ok: true,
        output: ragService.retrieve({
          merchant_id: getString(call.input, "merchant_id"),
          intent: getString(call.input, "intent"),
          query: getString(call.input, "query"),
          query_embedding: getOptionalNumberArray(call.input, "query_embedding"),
          top_k: getOptionalNumber(call.input, "top_k"),
          documents: Array.isArray(call.input.documents)
            ? (call.input.documents as VectorDocumentForAi[])
            : buildVectorDocumentsFromContext(getAiContext(call.input)),
        }),
      };
    case "chatto.load_customer_memory":
      return {
        name: call.name,
        ok: true,
        output: memoryService.loadCustomerMemories(),
      };
    case "chatto.evaluate_guardrails":
      return {
        name: call.name,
        ok: true,
        output: guardrailService.evaluate(getString(call.input, "message")),
      };
    case "chatto.draft_mock_reply":
      return {
        name: call.name,
        ok: true,
        output: mockAiReplyService.generateReply({
          intent: getString(call.input, "intent"),
          confidence: getOptionalNumber(call.input, "confidence") ?? 0,
          retrievedChunks: [],
        }),
      };
    case "chatto.evaluate_reply":
      return {
        name: call.name,
        ok: true,
        output: evaluationService.summarize(
          mockAiReplyService.generateReply({
            intent: getString(call.input, "intent"),
            confidence: getOptionalNumber(call.input, "confidence") ?? 0,
          }),
        ),
      };
    case "chatto.create_embedding":
      return {
        name: call.name,
        ok: true,
        output: await embeddingsService.createEmbedding(
          getString(call.input, "text") || "health check",
        ),
      };
  }
}

function requireMcpOutput<TOutput>(result: McpToolResult): TOutput {
  if (!result.ok) {
    throw new Error(result.error ?? `MCP tool failed: ${result.name}`);
  }

  return result.output as TOutput;
}

async function buildAiChatResponse(body: AiChatRequest) {
  const message = body.message.text;
  const aiContext = body.ai_context;
  const classification = requireMcpOutput<{ intent: string; confidence: number }>(
    await callMcpTool({
      name: "chatto.classify_intent",
      input: { message },
    }),
  );
  const prompt = promptManager.getPrompt("default");
  const context = requireMcpOutput(
    await callMcpTool({
      name: "chatto.build_context",
      input: {
        merchant_id: body.merchant_id,
        conversation_id: body.conversation_id,
        customer_id: body.customer.id,
        message,
        ai_context: aiContext,
      },
    }),
  );
  const vectorDocuments = buildVectorDocumentsFromContext(aiContext);
  const documentEmbeddings = await embeddingsService.enrichDocuments(
    vectorDocuments,
  );
  let queryEmbedding: number[] | undefined;
  let queryEmbeddingError: string | undefined;

  try {
    queryEmbedding = requireMcpOutput<{ values: number[] }>(
      await callMcpTool({
        name: "chatto.create_embedding",
        input: { text: message },
      }),
    ).values;
  } catch (error) {
    queryEmbeddingError = error instanceof Error ? error.message : String(error);
  }

  let vectorSync: unknown;

  try {
    vectorSync = await vectorStoreClient.syncDocuments(
      body.merchant_id,
      documentEmbeddings.documents,
    );
  } catch (error) {
    vectorSync = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const retrievedKnowledge = requireMcpOutput<RagRetrieveResult>(
    await callMcpTool({
      name: "chatto.retrieve_knowledge",
      input: {
        merchant_id: body.merchant_id,
        intent: classification.intent,
        query: message,
        query_embedding: queryEmbedding,
        top_k: body.ai_options?.top_k,
        documents: documentEmbeddings.documents,
      },
    }),
  );
  const customerMemories = requireMcpOutput(
    await callMcpTool({
      name: "chatto.load_customer_memory",
      input: { customer_id: body.customer.id },
    }),
  );
  const guardrail = requireMcpOutput(
    await callMcpTool({
      name: "chatto.evaluate_guardrails",
      input: { message },
    }),
  );
  const fallbackReply = mockAiReplyService.generateReply({
    ...classification,
    language: resolveReplyLanguage(message, body.ai_options?.language),
    retrievedChunks: retrievedKnowledge.chunks,
    merchantSettings: aiContext?.merchant_settings,
  });
  const llmReply = await llmReplyService.generateReply({
    intent: classification.intent,
    customerMessage: message,
    language: resolveReplyLanguage(message, body.ai_options?.language),
    conversationHistory: aiContext?.conversation_history ?? [],
    fallbackReply: fallbackReply.reply,
    merchantSettings: aiContext?.merchant_settings,
    retrievedChunks: retrievedKnowledge.chunks,
    systemInstruction: prompt.systemPrompt,
  });
  const reply = {
    ...fallbackReply,
    reply: llmReply.text,
    needs_handover:
      fallbackReply.needs_handover && !llmReply.usedExternalProvider,
  };
  const evaluation = evaluationService.summarize(reply);
  const embeddingsReady = {
    configured: embeddingsService.isConfigured(),
    model: embeddingsService.getModel(),
    dimensions: embeddingsService.getDimensions(),
    generated: documentEmbeddings.generated,
    reused: documentEmbeddings.reused,
    errors: documentEmbeddings.errors,
    query_error: queryEmbeddingError,
    vector_sync: vectorSync,
  };

  const aiResponse: AiChatResponse = {
    request_id: body.request_id,
    merchant_id: body.merchant_id,
    conversation_id: body.conversation_id,
    intent: classification.intent,
    reply: {
      text: reply.reply,
      confidence: reply.confidence,
    },
    sources: retrievedKnowledge.chunks.map((chunk) => ({
      source_type: chunk.source_type,
      source_id: chunk.source_id,
      title: chunk.title,
    })),
    generation: {
      provider: llmReply.provider,
      model: llmReply.model,
      used_external_provider: llmReply.usedExternalProvider,
      fallback_used: !llmReply.usedExternalProvider,
      fallback_reason: llmReply.usedExternalProvider ? undefined : llmReply.error,
      latency_ms: llmReply.latencyMs,
      timed_out: llmReply.timedOut,
    },
    actions: [],
    handover_required: reply.needs_handover,
    mcp: {
      server: mcpManifest.name,
      resources_used: [
        "merchant_profile",
        "channel_configuration",
        "conversation_history",
        "knowledge_documents",
        "vector_documents",
        "customer_memory",
        "guardrail_policy",
        "handover_policy",
      ],
      tools_called: [
        "chatto.classify_intent",
        "chatto.build_context",
        "chatto.retrieve_knowledge",
        "chatto.load_customer_memory",
        "chatto.evaluate_guardrails",
        "chatto.draft_mock_reply",
        "chatto.evaluate_reply",
        "chatto.create_embedding",
      ],
    },
  };

  return {
    ...aiResponse,
    debug: {
      prompt,
      context,
      retrievedKnowledge,
      customerMemories,
      guardrail,
      evaluation,
      embeddingsReady,
      llm: llmReply,
    },
  };
}

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "chatto-ai-service",
    mode: "mcp-hybrid-rag",
    mcpServer: mcpManifest.name,
    llmProvider: llmReplyService.getProvider(),
    externalLlmConfigured: llmReplyService.isExternalProviderConfigured(),
    openAiConfigured: openAiClient.isConfigured(),
    modules: [
      "mcp-manifest",
      "openai-client",
      "prompt-manager",
      "intent-classifier",
      "context-builder",
      "rag",
      "embeddings",
      "vector-store",
      "memory",
      "guardrails",
      "evaluation",
      "mock-ai-reply",
    ],
    timestamp: new Date().toISOString(),
  });
});

app.post("/mock-reply", async (request, response) => {
  const message =
    typeof request.body?.message === "string" ? request.body.message : "";
  const merchantId =
    typeof request.body?.merchantId === "string"
      ? request.body.merchantId
      : undefined;

  const classification = intentClassifier.classify(message);
  const prompt = promptManager.getPrompt("default");
  const context = contextBuilder.buildContext({ merchantId, message });
  const retrievedKnowledge = ragService.retrieve({
    merchant_id: merchantId,
    query: message,
  });
  const customerMemories = memoryService.loadCustomerMemories();
  const guardrail = guardrailService.evaluate(message);
  const reply = mockAiReplyService.generateReply(classification);
  const evaluation = evaluationService.summarize(reply);

  response.json({
    ...reply,
    debug: {
      prompt,
      context,
      retrievedKnowledge,
      customerMemories,
      guardrail,
      evaluation,
      embeddingsReady: await embeddingsService.createEmbedding(message || "health check"),
      mcp: {
        server: mcpManifest.name,
        resources_used: ["knowledge_documents", "vector_documents"],
        tools_called: ["chatto.retrieve_knowledge", "chatto.draft_mock_reply"],
      },
    },
  });
});

app.get("/mcp/manifest", (_request, response) => {
  response.json(mcpManifest);
});

app.get("/mcp/resources", (_request, response) => {
  response.json({ resources: mcpResources });
});

app.post("/mcp/resources/read", (request, response) => {
  const uri = typeof request.body?.uri === "string" ? request.body.uri : "";
  const aiContext = isRecord(request.body?.ai_context)
    ? (request.body.ai_context as AiContextForRequest)
    : undefined;

  try {
    response.json({
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            readMcpResource(uri, aiContext, request.body?.channel),
          ),
        },
      ],
    });
  } catch (error) {
    response.status(404).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/mcp/tools", (_request, response) => {
  response.json({ tools: mcpTools });
});

app.post("/mcp/tools/:toolName/call", async (request, response) => {
  const input = isRecord(request.body?.input) ? request.body.input : {};

  response.json(
    await callMcpTool({
      name: request.params.toolName as McpToolName,
      input,
    }),
  );
});

app.post("/mcp/chat", async (request, response) => {
  if (!hasValidServiceToken(request)) {
    rejectUnauthorized(request, response);
    return;
  }

  const body = request.body as Partial<AiChatRequest>;

  if (!isAiChatRequest(body)) {
    response.status(400).json({
      error: {
        code: "BAD_AI_CHAT_REQUEST",
        message: "Request body does not match AiChatRequest.",
        request_id: request.headers["x-request-id"] ?? "unknown",
      },
    });
    return;
  }

  try {
    response.json(await buildAiChatResponse(body));
  } catch (error) {
    response.status(500).json({
      error: {
        code: "AI_PIPELINE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        request_id: body.request_id,
      },
    });
  }
});

app.post("/mcp", async (request, response) => {
  const id = request.body?.id ?? null;
  const method = typeof request.body?.method === "string" ? request.body.method : "";
  const params = isRecord(request.body?.params) ? request.body.params : {};

  if (method === "initialize" || method === "mcp/manifest") {
    response.json({ jsonrpc: "2.0", id, result: mcpManifest });
    return;
  }

  if (method === "resources/list") {
    response.json({ jsonrpc: "2.0", id, result: { resources: mcpResources } });
    return;
  }

  if (method === "resources/read") {
    const uri = getString(params, "uri");
    const aiContext = isRecord(params.ai_context)
      ? (params.ai_context as AiContextForRequest)
      : undefined;

    try {
      response.json({
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(
                readMcpResource(uri, aiContext, getString(params, "channel")),
              ),
            },
          ],
        },
      });
    } catch (error) {
      response.status(404).json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32002,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
    return;
  }

  if (method === "tools/list") {
    response.json({ jsonrpc: "2.0", id, result: { tools: mcpTools } });
    return;
  }

  if (method === "tools/call") {
    const name = getString(params, "name") as McpToolName;
    const input = isRecord(params.input) ? params.input : {};

    response.json({
      jsonrpc: "2.0",
      id,
      result: await callMcpTool({ name, input }),
    });
    return;
  }

  response.status(404).json({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Unknown MCP method: ${method}`,
    },
  });
});

app.post("/ai/chat", async (request, response) => {
  if (!hasValidServiceToken(request)) {
    rejectUnauthorized(request, response);
    return;
  }

  const body = request.body as Partial<AiChatRequest>;

  if (!isAiChatRequest(body)) {
    response.status(400).json({
      error: {
        code: "BAD_AI_CHAT_REQUEST",
        message: "Request body does not match AiChatRequest.",
        request_id: request.headers["x-request-id"] ?? "unknown",
      },
    });
    return;
  }

  try {
    response.json(await buildAiChatResponse(body));
  } catch (error) {
    response.status(500).json({
      error: {
        code: "AI_PIPELINE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        request_id: body.request_id,
      },
    });
  }
});

app.listen(port, () => {
  console.log(`Chatto AI Service listening on port ${port}`);
});
