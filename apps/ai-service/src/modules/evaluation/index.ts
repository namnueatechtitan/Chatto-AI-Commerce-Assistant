import type { AiResponse } from "../../types/ai-response";

export class EvaluationService {
  summarize(response: AiResponse) {
    return {
      evaluationMode: "response-contract",
      responseIntent: response.intent,
      passed: Boolean(response.reply.trim()) && Number.isFinite(response.confidence)
        && response.confidence >= 0 && response.confidence <= 1,
    };
  }
}
