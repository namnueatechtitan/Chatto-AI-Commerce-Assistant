import { NotImplementedException } from "@nestjs/common";
// Repository HTTP consumer audit found no callers. External compatibility still
// needs approval; the default remains unchanged until routes are explicitly approved.
export const scaffoldRoutes = new Set([
  "products", "product-variants", "product-images", "channels", "customers",
  "conversations", "messages", "knowledge-base-documents", "vector-documents",
  "merchant-users", "line-webhook-events", "ai-settings", "ai-action-logs",
  "guardrail-events", "customer-memories", "handover-tickets", "handover-messages",
  "handover-assignments", "users", "roles", "permissions", "platforms", "prompt-versions",
]);
export function assertScaffoldAvailable(route: string): void {
  const approved = (process.env.SCAFFOLD_501_APPROVED_ROUTES ?? "").split(",").map((value) => value.trim());
  if (scaffoldRoutes.has(route) && approved.includes(route))
    throw new NotImplementedException("This scaffold endpoint is not implemented");
}
