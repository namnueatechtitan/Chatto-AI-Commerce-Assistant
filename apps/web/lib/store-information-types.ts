export interface Faq { id?: string; question: string; answer: string }
export interface StoreInformation {
  merchant: { id: string; shopName: string; businessCategory: string | null; operatingHours: string | null; description: string | null; phone: string | null; email: string | null; address: string | null; informationRevision: number; status: string };
  faqs: Faq[]; canEdit: boolean;
}
export interface CatalogRow { row: number; product: { name: string; description: string | null; category: string | null; brand: string | null }; errors: string[]; warnings: string[] }
export interface CatalogJob {
  id: string; merchantId: string; originalName: string; format: string; status: "PARSING" | "PREVIEW" | "IMPORTED" | "FAILED" | "CANCELLED";
  preview: { rows: CatalogRow[]; fields: ("name" | "description" | "category" | "brand")[]; warnings: string[]; validCount: number } | null;
  error: string | null; createdCount: number; updatedCount: number; rejectedCount: number; expiresAt: string;
}
