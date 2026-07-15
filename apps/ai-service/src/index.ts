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
    description: "Conversation history placeholder for future context replay.",
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
    description: "Phase 2 vector-document rows with null embeddings.",
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
    description: "Build message context from MCP resource placeholders.",
    read_only: true,
    phase: "phase-2",
  },
  {
    name: "chatto.retrieve_knowledge",
    description: "Run placeholder RAG over supplied vector-document rows.",
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
    name: "chatto.create_embedding_placeholder",
    description: "Return the Phase 2 embedding placeholder.",
    read_only: true,
    phase: "phase-2",
  },
];

const mcpManifest: McpManifest = {
  name: "chatto-phase-2-mcp",
  version: "0.1.0",
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
      merchant_id: row.merchantId,
      source_type: row.sourceType,
      source_id: row.sourceId,
      chunk_text: row.chunkText,
      embedding: row.embedding,
      metadata: row.metadata,
      status: row.status,
    }),
  );

  const liveSourceKeys = new Set(
    liveDocuments.map(
      (document) => `${document.source_type}:${document.source_id}`,
    ),
  );
  const additionalStoredDocuments = (aiContext.vector_documents ?? []).filter(
    (document) =>
      !liveSourceKeys.has(`${document.source_type}:${document.source_id}`),
  );

  return [...liveDocuments, ...additionalStoredDocuments];
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

function callMcpTool(call: McpToolCall): McpToolResult {
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
          top_k: getOptionalNumber(call.input, "top_k"),
          documents: buildVectorDocumentsFromContext(getAiContext(call.input)),
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
    case "chatto.create_embedding_placeholder":
      return {
        name: call.name,
        ok: true,
        output: embeddingsService.createEmbedding(),
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
    callMcpTool({
      name: "chatto.classify_intent",
      input: { message },
    }),
  );
  const prompt = promptManager.getPrompt("default");
  const context = requireMcpOutput(
    callMcpTool({
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
  const retrievedKnowledge = requireMcpOutput<RagRetrieveResult>(
    callMcpTool({
      name: "chatto.retrieve_knowledge",
      input: {
        merchant_id: body.merchant_id,
        intent: classification.intent,
        query: message,
        top_k: body.ai_options?.top_k,
        ai_context: aiContext,
      },
    }),
  );
  const customerMemories = requireMcpOutput(
    callMcpTool({
      name: "chatto.load_customer_memory",
      input: { customer_id: body.customer.id },
    }),
  );
  const guardrail = requireMcpOutput(
    callMcpTool({
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
  const embeddingsReady = requireMcpOutput(
    callMcpTool({
      name: "chatto.create_embedding_placeholder",
      input: {},
    }),
  );

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
        "chatto.create_embedding_placeholder",
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
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "chatto-ai-service",
    mode: "mcp-mock",
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
      "memory",
      "guardrails",
      "evaluation",
      "mock-ai-reply",
    ],
    timestamp: new Date().toISOString(),
  });
});

app.post("/mock-reply", (request, response) => {
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
      embeddingsReady: embeddingsService.createEmbedding(),
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

app.get("/mcp/tools", (_request, response) => {
  response.json({ tools: mcpTools });
});

app.post("/mcp/tools/:toolName/call", (request, response) => {
  const input = isRecord(request.body?.input) ? request.body.input : {};

  response.json(
    callMcpTool({
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

  response.json(await buildAiChatResponse(body));
});

app.post("/mcp", (request, response) => {
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
      result: callMcpTool({ name, input }),
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

  response.json(await buildAiChatResponse(body));
});

app.listen(port, () => {
  console.log(`Chatto AI Service listening on port ${port}`);
});
