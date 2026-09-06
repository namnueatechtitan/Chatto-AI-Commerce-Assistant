import type { AiChatRequest, AiChatResponse, McpToolName, RagRetrieveResult } from "../types/ai-contract.types";
import type { AiResponse } from "../types/ai-response";
import { CONTEXT_FREE_INTENTS, type ConfidenceResult } from "./confidence";
import { safeHandoverReply, type GuardrailResult } from "./guardrails";
import { LlmReplyService } from "./llm";
import type { GenerateLlmReplyResult } from "./llm/llm.types";
import { McpToolRegistry } from "./mcp/tools";
import { buildVectorDocumentsFromContext } from "./mcp/context";
import { assertMerchantContext } from "./mcp/schemas";
import { PromptManager } from "./prompt-manager";
import { VectorStoreClient } from "./vector-store";

export class ChatPipeline {
  constructor(
    readonly tools = new McpToolRegistry(),
    private readonly llm: Pick<LlmReplyService, "generateReply"> = new LlmReplyService(),
    private readonly vectors: Pick<VectorStoreClient, "syncDocuments"> = new VectorStoreClient(),
  ) {}

  async chat(body: AiChatRequest): Promise<AiChatResponse> {
    assertMerchantContext(body.merchant_id, body.ai_context);
    const toolsCalled: McpToolName[] = [];
    const invoke = async <T>(name: McpToolName, input: Record<string, unknown>): Promise<T> => {
      toolsCalled.push(name);
      const result = await this.tools.call(name, input, body.merchant_id);
      if (!result.ok) throw new Error(result.error ?? "TOOL_FAILED");
      return result.output as T;
    };
    const message = body.message.text;
    const language = /[\u0E00-\u0E7F]/u.test(message) ? "th"
      : body.ai_options?.language?.toLowerCase() ?? body.ai_context?.merchant_settings?.default_language ?? "en";
    const guardrails: GuardrailResult[] = [await invoke("chatto.evaluate_guardrails", { message })];
    const classification = await invoke<{ intent: string; confidence: number }>("chatto.classify_intent", { message });
    const contextFree = CONTEXT_FREE_INTENTS.has(classification.intent);
    let retrieval: RagRetrieveResult = { mode: "hybrid_lexical_fallback", query: message, top_k: body.ai_options?.top_k ?? 3, chunks: [] };
    const resourcesUsed: NonNullable<AiChatResponse["mcp"]>["resources_used"] = ["guardrail_policy", "handover_policy"];

    // Scan all supplied context, including earlier conversation messages, BEFORE
    // any external embedding/LLM call or vector persistence.
    if (!guardrails[0].requires_handover) {
      guardrails.push(this.tools.guardrails.evaluateContext(JSON.stringify(body.ai_context ?? {})));
    }
    const blocked = guardrails.some(check => !check.allowed);
    const forceHandover = guardrails.some(check => check.requires_handover);
    if (!blocked && !forceHandover && !contextFree && classification.intent !== "unknown") {
      await invoke("chatto.build_context", { merchant_id: body.merchant_id, message, ai_context: body.ai_context });
      resourcesUsed.push("merchant_profile", "knowledge_documents", "vector_documents");
      const documents = buildVectorDocumentsFromContext(body.ai_context);
      const enriched = await this.tools.embeddings.enrichDocuments(documents);
      let queryEmbedding: number[] | undefined;
      if (this.tools.embeddings.isConfigured()) {
        try {
          queryEmbedding = (await invoke<{ values: number[] }>("chatto.create_embedding", { text: message })).values;
        } catch { /* Evidence scoring handles lexical fallback without fabricated confidence. */ }
      }
      if (enriched.generated > 0) {
        try { await this.vectors.syncDocuments(body.merchant_id, enriched.documents); }
        catch { /* Persistence failure does not invalidate in-request source evidence. */ }
      }
      retrieval = await invoke("chatto.retrieve_knowledge", {
        merchant_id: body.merchant_id, intent: classification.intent, query: message,
        query_embedding: queryEmbedding, top_k: body.ai_options?.top_k, documents: enriched.documents,
      });
      // RAG may include type-only candidates for recall. Keep weak candidates
      // out of the LLM even when another chunk supplies strong evidence.
      retrieval.chunks = retrieval.chunks.filter(chunk =>
        Math.max(chunk.semantic_score ?? 0, chunk.lexical_score) >= 0.35);
    }
    const confidenceInput = {
      intent: classification.intent, intent_confidence: classification.confidence,
      chunks: retrieval.chunks, threshold: body.ai_context?.merchant_settings?.handover_threshold,
      blocked, force_handover: forceHandover,
    };
    let confidence = await invoke<ConfidenceResult>("chatto.calculate_confidence", confidenceInput);
    let text = safeHandoverReply(language, blocked);
    let generation: GenerateLlmReplyResult = {
      provider: "mock", model: null, text, usedExternalProvider: false, latencyMs: 0,
      error: confidence.decision === "handover" ? "SAFETY_OR_CONFIDENCE_GATE" : undefined,
    };
    if (confidence.decision === "answer") {
      const fallback = await invoke<AiResponse>("chatto.draft_mock_reply", {
        intent: classification.intent, confidence: confidence.score, language,
        retrievedChunks: retrieval.chunks, merchantSettings: body.ai_context?.merchant_settings,
      });
      // Context-free greetings use a deterministic reply; no ungrounded LLM facts.
      if (contextFree) {
        generation = { provider: "mock", model: null, text: fallback.reply, usedExternalProvider: false, latencyMs: 0 };
      } else {
        resourcesUsed.push("conversation_history");
        generation = await this.llm.generateReply({
          intent: classification.intent, customerMessage: message, language,
          conversationHistory: body.ai_context?.conversation_history ?? [],
          fallbackReply: fallback.reply, merchantSettings: body.ai_context?.merchant_settings,
          retrievedChunks: retrieval.chunks,
          systemInstruction: new PromptManager().getPrompt("default").systemPrompt,
        });
      }
      const output = await invoke<GuardrailResult>("chatto.validate_output", {
        reply: generation.text, chunks: retrieval.chunks, requires_evidence: !contextFree,
      });
      // Never return the rejected candidate in a debug payload.
      guardrails.push(output);
      if (output.allowed) text = generation.text;
      else {
        text = safeHandoverReply(language, true);
        confidence = await invoke("chatto.calculate_confidence", { ...confidenceInput, blocked: true, force_handover: true });
      }
    }
    const handover = confidence.decision === "handover";
    await invoke("chatto.evaluate_reply", { reply: text, intent: classification.intent, confidence: confidence.score, needs_handover: handover });
    const reasons = [...new Set([...guardrails.flatMap(check => check.reasons), ...confidence.reasons])];
    return {
      request_id: body.request_id, merchant_id: body.merchant_id, conversation_id: body.conversation_id,
      intent: classification.intent, reply: { text, confidence: confidence.score },
      confidence, guardrails, handover_required: handover,
      handover_reason: handover ? reasons[0] ?? "HUMAN_REVIEW_REQUIRED" : undefined,
      sources: handover ? [] : retrieval.chunks.map(chunk => ({ source_type: chunk.source_type, source_id: chunk.source_id, title: chunk.title })),
      actions: [],
      generation: {
        provider: generation.provider, model: generation.model,
        used_external_provider: generation.usedExternalProvider,
        fallback_used: handover || !generation.usedExternalProvider,
        // Upstream error bodies may contain confidential context; return codes only.
        fallback_reason: handover ? "SAFETY_OR_CONFIDENCE_GATE" : generation.error ? "PROVIDER_UNAVAILABLE" : undefined,
        latency_ms: generation.latencyMs, timed_out: generation.timedOut,
      },
      mcp: { server: "chatto-phase-2-mcp", resources_used: [...new Set(resourcesUsed)], tools_called: toolsCalled },
    };
  }
}
