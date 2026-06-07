export class IntentClassifier {
  classify(message: string) {
    return {
      intent: message.trim() ? "general_question" : "empty_message",
      confidence: message.trim() ? 0.8 : 0.2,
    };
  }
}
