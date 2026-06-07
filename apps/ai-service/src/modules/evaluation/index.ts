import type { AiResponse } from "../../types/ai-response";

export class EvaluationService {
  summarize(response: AiResponse) {
    return {
      evaluationMode: "placeholder",
      responseIntent: response.intent,
      passed: true,
    };
  }
}
