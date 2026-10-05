export interface Evidence { id: string; origin_id?: string; type: string; title: string; text: string }
export interface BoundClaim { source_id: string; quote: string }
/** Only exact source spans can leave the service. Relevance remains independently evaluated. */
export function bindClaims(candidate: unknown, sources: Evidence[]): BoundClaim[] {
  if (!Array.isArray(candidate) || candidate.length > 6) throw new Error("INVALID_CLAIMS");
  const claims: BoundClaim[] = [];
  for (const item of candidate) {
    if (typeof item !== "object" || item === null) throw new Error("INVALID_CLAIM");
    const { source_id, quote } = item as Record<string, unknown>;
    if (typeof source_id !== "string" || typeof quote !== "string" || !quote.trim() || quote.length > 2000) throw new Error("INVALID_CLAIM");
    const source = sources.find(s => s.id === source_id);
    const exactQuote=source?.text.includes(quote)?quote:quote.normalize("NFKC");
    if (!source || !source.text.includes(exactQuote)) throw new Error("UNSUPPORTED_CLAIM");
    if (!claims.some(c => c.source_id === source_id && c.quote === exactQuote)) claims.push({ source_id, quote:exactQuote });
  }
  return claims;
}
export function renderCatalogRow(row: Record<string, unknown>): string {
  // Keep each database field paired with its value, including unknown and zero.
  return Object.entries(row).map(([key, value]) => `${key}: ${value === null ? "unknown" : String(value)}`).join("; ");
}
