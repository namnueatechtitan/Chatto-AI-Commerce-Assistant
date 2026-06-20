import cors from "cors";
import express from "express";

import { ContextBuilder } from "./modules/context-builder";
import { EmbeddingsService } from "./modules/embeddings";
import { EvaluationService } from "./modules/evaluation";
import { GuardrailService } from "./modules/guardrails";
import { IntentClassifier } from "./modules/intent-classifier";
import { MemoryService } from "./modules/memory";
import { MockAiReplyService } from "./modules/mock-ai-reply";
import { OpenAiClientStub } from "./modules/openai-client";
import { PromptManager } from "./modules/prompt-manager";
import { RagService } from "./modules/rag";
import type { AiChatRequest, AiChatResponse } from "./types/ai-contract.types";


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

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "chatto-ai-service",
    mode: "mock",
    openAiConfigured: openAiClient.isConfigured(),
    modules: [
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
  const retrievedChunks = ragService.retrieve();
  const customerMemories = memoryService.loadCustomerMemories();
  const guardrail = guardrailService.evaluate(message);
  const reply = mockAiReplyService.generateReply(classification);
  const evaluation = evaluationService.summarize(reply);

  response.json({
    ...reply,
    debug: {
      prompt,
      context,
      retrievedChunks,
      customerMemories,
      guardrail,
      evaluation,
      embeddingsReady: embeddingsService.createEmbedding(),
    },
  });
});

app.post("/ai/chat", (request, response) => {
  const expectedToken = process.env.AI_SERVICE_TOKEN ?? "dev_internal_service_token";
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing AI service token.",
        request_id: request.headers["x-request-id"] ?? "unknown",
      },
    });
    return;
  }

  const token = authorization.replace("Bearer ", "").trim();

  if (token !== expectedToken) {
    response.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid AI service token.",
        request_id: request.headers["x-request-id"] ?? "unknown",
      },
    });
    return;
  }

  const body = request.body as Partial<AiChatRequest>;

  if (
    typeof body.request_id !== "string" ||
    typeof body.merchant_id !== "string" ||
    typeof body.channel !== "string" ||
    typeof body.conversation_id !== "string" ||
    !body.customer ||
    typeof body.customer.id !== "string" ||
    !body.message ||
    typeof body.message.id !== "string" ||
    typeof body.message.text !== "string" ||
    typeof body.message.timestamp !== "string"
  ) {
    response.status(400).json({
      error: {
        code: "BAD_AI_CHAT_REQUEST",
        message: "Request body does not match AiChatRequest.",
        request_id: request.headers["x-request-id"] ?? "unknown",
      },
    });
    return;
  }

  const message = body.message.text;

  const classification = intentClassifier.classify(message);
  const prompt = promptManager.getPrompt("default");
  const context = contextBuilder.buildContext({
    merchantId: body.merchant_id,
    message,
  });
  const retrievedChunks = ragService.retrieve();
  const customerMemories = memoryService.loadCustomerMemories();
  const guardrail = guardrailService.evaluate(message);
  const reply = mockAiReplyService.generateReply(classification);
  const evaluation = evaluationService.summarize(reply);

  const replyObject = reply as Record<string, unknown>;

  const replyText =
    typeof replyObject.text === "string"
      ? replyObject.text
      : typeof replyObject.reply === "string"
        ? replyObject.reply
        : typeof replyObject.message === "string"
          ? replyObject.message
          : "I received your message. I am checking the store information for you.";

  const confidence =
    typeof replyObject.confidence === "number"
      ? replyObject.confidence
      : 0.7;

  const aiResponse: AiChatResponse = {
    request_id: body.request_id,
    merchant_id: body.merchant_id,
    conversation_id: body.conversation_id,
    intent: typeof classification === "string" ? classification : "unknown",
    reply: {
      text: replyText,
      confidence,
    },
    sources: [],
    actions: [],
    handover_required: false,
  };

  response.json({
    ...aiResponse,
    debug: {
      prompt,
      context,
      retrievedChunks,
      customerMemories,
      guardrail,
      evaluation,
      embeddingsReady: embeddingsService.createEmbedding(),
    },
  });
});

app.listen(port, () => {
  console.log(`Chatto AI Service listening on port ${port}`);
});
