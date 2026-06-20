import type {
  AiKnowledgeDocument,
  KnowledgeBaseExportResponse,
  ProductExportResponse,
  ProductForAi,
} from "../../types/ai-contract.types";

function joinNonEmpty(parts: Array<string | null | undefined>): string {
  return parts.filter((part) => Boolean(part && part.trim())).join(" ");
}

function moneyText(price: number | null, currency: string): string {
  if (price === null) return "Price: not specified.";
  return `Price: ${price} ${currency}.`;
}

export function buildProductKnowledgeDocument(product: ProductForAi): AiKnowledgeDocument {
  const variantText = product.variants
    .map((variant) =>
      joinNonEmpty([
        `Variant: ${variant.variant_name}.`,
        variant.color ? `Color: ${variant.color}.` : undefined,
        variant.size ? `Size: ${variant.size}.` : undefined,
        variant.sku ? `SKU: ${variant.sku}.` : undefined,
        moneyText(variant.price, variant.currency),
        `Available quantity: ${variant.available_qty}.`,
      ]),
    )
    .join(" ");

  return {
    merchant_id: product.merchant_id,
    source_type: "product",
    source_id: product.id,
    title: product.name,
    content: joinNonEmpty([
      `Product: ${product.name}.`,
      product.description ? `Description: ${product.description}.` : undefined,
      product.category ? `Category: ${product.category}.` : undefined,
      product.brand ? `Brand: ${product.brand}.` : undefined,
      moneyText(product.price, product.currency),
      variantText,
    ]),
    metadata: {
      title: product.name,
      product_id: product.id,
      category: product.category,
      brand: product.brand,
      price: product.price,
      currency: product.currency,
      image_urls: product.image_urls,
      variant_ids: product.variants.map((variant) => variant.id),
      status: product.status,
      updated_at: product.updated_at,
    },
  };
}

export function buildProductKnowledgeDocuments(
  exportResponse: ProductExportResponse,
): AiKnowledgeDocument[] {
  return exportResponse.products
    .filter((product) => product.status === "active")
    .map(buildProductKnowledgeDocument);
}

export function buildKnowledgeBaseDocuments(
  exportResponse: KnowledgeBaseExportResponse,
): AiKnowledgeDocument[] {
  return exportResponse.knowledge_base
    .filter((item) => item.status === "active")
    .map((item) => ({
      merchant_id: item.merchant_id,
      source_type: item.type,
      source_id: item.id,
      title: item.title,
      content: `${item.title}: ${item.content}`,
      metadata: {
        title: item.title,
        knowledge_base_id: item.id,
        type: item.type,
        status: item.status,
        updated_at: item.updated_at,
      },
    }));
}

export function toVectorDocumentRows(documents: AiKnowledgeDocument[]) {
  return documents.map((document) => ({
    merchantId: document.merchant_id,
    sourceType: document.source_type,
    sourceId: document.source_id,
    chunkText: document.content,
    embedding: null,
    metadata: {
      ...document.metadata,
      title: document.title,
    },
    status: "ACTIVE",
  }));
}
