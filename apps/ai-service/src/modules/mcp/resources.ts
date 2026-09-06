import { resolveHandoverThreshold } from "../confidence";
import { assertMerchantContext, contextSchema } from "./schemas";

export const resources = [
  { name: "guardrail_policy", uri: "chatto://ai/guardrails/default", description: "Phase 2 input/context/output safety policy.", mimeType: "application/json" },
  { name: "handover_policy", uri: "chatto://handover/policy/default", description: "Default evidence scoring and human review policy.", mimeType: "application/json" },
];
export const resourceTemplates = [
  { name: "merchant_profile", uriTemplate: "chatto://merchants/{merchant_id}", description: "Live merchant settings from the trusted backend.", mimeType: "application/json" },
  { name: "knowledge_documents", uriTemplate: "chatto://merchants/{merchant_id}/knowledge-base", description: "Active merchant knowledge records.", mimeType: "application/json" },
  { name: "vector_documents", uriTemplate: "chatto://merchants/{merchant_id}/vector-documents", description: "Merchant-scoped vector documents.", mimeType: "application/json" },
];

export async function readResource(uri: string, merchantId?: string, suppliedContext?: unknown): Promise<unknown> {
  if (uri === resources[0].uri) return {
    version: "1.0", stages: ["input", "context", "output"], commerce_actions_allowed: false,
    on_block: "safe_reply_and_handover", rule_based: true,
  };
  if (uri === resources[1].uri) return {
    threshold: resolveHandoverThreshold(), low_confidence_action: "handover",
    score_is_calibrated_probability: false, explicit_human_request: "handover",
  };
  const match = /^chatto:\/\/merchants\/([^/]+)(?:\/(knowledge-base|vector-documents))?$/u.exec(uri);
  if (!match) throw new Error("UNKNOWN_RESOURCE");
  if (!merchantId || match[1] !== merchantId) throw new Error("MERCHANT_SCOPE_MISMATCH");
  const kind = match[2];
  let rawContext = suppliedContext;
  if (rawContext === undefined) {
    const base = (process.env.INTERNAL_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
    const merchant = encodeURIComponent(merchantId);
    const endpoint = kind ? `${kind}/export?merchant_id=${merchant}` : `merchant-settings/${merchant}`;
    const response = await fetch(`${base}/internal/ai/${endpoint}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN || "dev_internal_service_token"}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("RESOURCE_BACKEND_UNAVAILABLE");
    const value: unknown = await response.json();
    rawContext = kind === "knowledge-base" ? { knowledge_base: value }
      : kind === "vector-documents" ? { vector_documents: value } : { merchant_settings: value };
  }
  const context = contextSchema.parse(rawContext);
  assertMerchantContext(merchantId, context);
  return kind === "knowledge-base" ? context.knowledge_base ?? { merchant_id: merchantId, knowledge_base: [] }
    : kind === "vector-documents" ? context.vector_documents ?? [] : context.merchant_settings ?? {};
}
