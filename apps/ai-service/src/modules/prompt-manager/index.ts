export class PromptManager {
  getPrompt(name: string) {
    return {
      name,
      version: 1,
      systemPrompt: "Phase 2 prompt scaffold",
    };
  }
}
