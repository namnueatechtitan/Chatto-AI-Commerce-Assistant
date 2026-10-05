import type { AiContextForRequest } from "../../types/ai-contract.types";

export class ContextBuilder {
  buildContext(input: {
    merchantId?: string;
    message: string;
    aiContext?: AiContextForRequest;
  }) {
    return {
      merchantId: input.merchantId ?? null,
      message: input.message,
      merchantSettings: input.aiContext?.merchant_settings ?? null,
      products: input.aiContext?.products?.products ?? [],
      knowledgeDocuments: input.aiContext?.knowledge_base?.knowledge_base ?? [],
      vectorDocumentCount: input.aiContext?.vector_documents?.length ?? 0,
      conversationHistory: input.aiContext?.conversation_history ?? [],
    };
  }
}
