// Shared policy contract: keep API and AI copies identical (parity is tested).
export type ServiceTokenName = "AI_SERVICE_TOKEN" | "INTERNAL_SERVICE_TOKEN";
export function strongServiceToken(token: string): boolean {
  if (token !== token.trim() || /(?:dev_|example|placeholder|change.?me|your[_-])/i.test(token)) return false;
  const hex = /^[0-9a-f]{64}$/i.test(token);
  const base64 = /^[A-Za-z0-9_-]{43}$/.test(token) &&
    Buffer.from(token, "base64url").length === 32 &&
    Buffer.from(token, "base64url").toString("base64url") === token;
  return (hex || base64) && new Set(token).size >= 8;
}
export function productionServiceCredentialsValid(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  const ai = env.AI_SERVICE_TOKEN ?? "", internal = env.INTERNAL_SERVICE_TOKEN ?? "";
  return strongServiceToken(ai) && strongServiceToken(internal) && ai !== internal;
}
export function validateProductionServiceCredentials(env: NodeJS.ProcessEnv = process.env): void {
  if (!productionServiceCredentialsValid(env)) throw new Error("Production service authentication configuration is unsafe");
}
