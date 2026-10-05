import { z } from "zod";
import { ContextBuilder } from "../context-builder";
import { ConfidenceService } from "../confidence";
import { EmbeddingsService } from "../embeddings";
import { EvaluationService } from "../evaluation";
import { GuardrailService } from "../guardrails";
import { IntentClassifier } from "../intent-classifier";
import { MemoryService } from "../memory";
import { MockAiReplyService } from "../mock-ai-reply";
import { RagService } from "../rag";
import { PromptManager } from "../prompt-manager";
import { assertMerchantContext, toolSchemas } from "./schemas";
import type { McpToolName, McpToolResult } from "../../types/ai-contract.types";

const descriptions: Record<McpToolName, string> = {
  "chatto.classify_intent": "Classify a Thai or English customer message.",
  "chatto.build_context": "Build context from validated merchant-scoped data supplied by the trusted API.",
  "chatto.retrieve_knowledge": "Retrieve merchant-scoped evidence using hybrid RAG.",
  "chatto.load_customer_memory": "Return the Phase 2 customer memory scaffold (currently empty).",
  "chatto.evaluate_guardrails": "Check input safety and explicit requests for human support.",
  "chatto.draft_mock_reply": "Draft a deterministic reply from supplied evidence.",
  "chatto.evaluate_reply": "Summarize the supplied reply for evaluation.",
  "chatto.create_embedding": "Create a retrieval embedding; may call the configured Gemini provider.",
  "chatto.calculate_confidence": "Score evidence and decide answer versus handover using an explainable heuristic.",
  "chatto.validate_output": "Check a candidate reply for secrets, unsupported actions and unsupported numbers.",
};

export class McpToolRegistry {
  readonly guardrails = new GuardrailService();
  readonly confidence = new ConfidenceService();
  readonly embeddings = new EmbeddingsService();
  private readonly classifier = new IntentClassifier();
  private readonly context = new ContextBuilder();
  private readonly rag = new RagService();
  private readonly memory = new MemoryService();
  private readonly mock = new MockAiReplyService();
  private readonly evaluation = new EvaluationService();

  list() {
    return (Object.keys(toolSchemas) as McpToolName[]).map(name => ({
      name, description: descriptions[name],
      inputSchema: z.toJSONSchema(toolSchemas[name], { target: "draft-7" }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: name === "chatto.create_embedding" },
    }));
  }

  async call(name: string, input: unknown, merchantId?: string): Promise<McpToolResult> {
    if (!Object.hasOwn(toolSchemas, name)) return { name: name as McpToolName, ok: false, error: "UNKNOWN_TOOL" };
    try {
      const parsed = toolSchemas[name as McpToolName].parse(input);
      if ("merchant_id" in parsed && merchantId && parsed.merchant_id !== merchantId) throw new Error("MERCHANT_SCOPE_MISMATCH");
      if ("merchantSettings" in parsed && parsed.merchantSettings && merchantId && parsed.merchantSettings.merchant_id !== merchantId) throw new Error("MERCHANT_SCOPE_MISMATCH");
      const output = await this.execute(name as McpToolName, parsed);
      return { name: name as McpToolName, ok: true, output };
    } catch (error) {
      return { name: name as McpToolName, ok: false,
        error: error instanceof z.ZodError ? "INVALID_TOOL_ARGUMENTS" : error instanceof Error ? error.message : "TOOL_FAILED" };
    }
  }

  private async execute(name: McpToolName, input: unknown): Promise<unknown> {
    switch (name) {
      case "chatto.classify_intent": return this.classifier.classify(toolSchemas[name].parse(input).message);
      case "chatto.build_context": {
        const value = toolSchemas[name].parse(input);
        assertMerchantContext(value.merchant_id, value.ai_context);
        return this.context.buildContext({ merchantId: value.merchant_id, message: value.message, aiContext: value.ai_context });
      }
      case "chatto.retrieve_knowledge": {
        const value = toolSchemas[name].parse(input);
        assertMerchantContext(value.merchant_id, { vector_documents: value.documents });
        return this.rag.retrieve(value);
      }
      case "chatto.load_customer_memory": return this.memory.loadCustomerMemories();
      case "chatto.evaluate_guardrails": return this.guardrails.evaluate(toolSchemas[name].parse(input).message);
      case "chatto.calculate_confidence": return this.confidence.evaluate(toolSchemas[name].parse(input));
      case "chatto.validate_output": return this.guardrails.evaluateOutput({ ...toolSchemas[name].parse(input), system_prompt: new PromptManager().getSystemInstruction() });
      case "chatto.draft_mock_reply": {
        const value = toolSchemas[name].parse(input);
        if (!this.guardrails.evaluateContext(JSON.stringify(value)).allowed) throw new Error("UNSAFE_CONTEXT");
        return this.mock.generateReply(value);
      }
      case "chatto.evaluate_reply": return this.evaluation.summarize({ ...toolSchemas[name].parse(input), suggested_action: null });
      case "chatto.create_embedding": {
        const value = toolSchemas[name].parse(input);
        if (!this.embeddings.isConfigured()) throw new Error("EMBEDDING_NOT_CONFIGURED");
        if (!this.guardrails.evaluateContext(value.text).allowed) throw new Error("UNSAFE_EMBEDDING_INPUT");
        return this.embeddings.createEmbedding(value.text);
      }
    }
  }
}
