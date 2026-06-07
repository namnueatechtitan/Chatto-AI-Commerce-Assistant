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

app.listen(port, () => {
  console.log(`Chatto AI Service listening on port ${port}`);
});
