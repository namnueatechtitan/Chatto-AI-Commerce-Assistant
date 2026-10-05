export interface AiResponse {
  intent: string;
  confidence: number;
  reply: string;
  needs_handover: boolean;
  suggested_action: string | null;
}
