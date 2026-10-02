export const CATALOG_LIMITS = { bytes: 5 * 1024 * 1024, rows: 500, columns: 12, pages: 20, timeoutMs: 15000 } as const;
export type CatalogFormat = "csv" | "xlsx" | "pdf";
export interface CatalogProduct { name: string; description: string | null; category: string | null; brand: string | null }
export interface CatalogRow { row: number; product: CatalogProduct; errors: string[]; warnings: string[] }
export interface CatalogPreview { rows: CatalogRow[]; fields: (keyof CatalogProduct)[]; warnings: string[]; validCount: number }
export function productKey(name: string): string { return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(); }
