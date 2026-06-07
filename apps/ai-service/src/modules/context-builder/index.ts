export class ContextBuilder {
  buildContext(input: { merchantId?: string; message: string }) {
    return {
      merchantId: input.merchantId ?? null,
      message: input.message,
      products: [],
      knowledgeDocuments: [],
    };
  }
}
