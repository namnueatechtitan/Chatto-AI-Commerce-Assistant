export class GuardrailService {
  evaluate(message: string) {
    return {
      allowed: true,
      severity: "low",
      reason: message ? "No guardrail issues detected in mock mode" : "Empty input",
    };
  }
}
