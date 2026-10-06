// Explicit safe response contracts, never raw Prisma channel/settings objects.
export interface ActivationCheckDto { ready: boolean; code: string; title: string }
export interface ActivationChecksDto {
  store: ActivationCheckDto;
  line: ActivationCheckDto;
  knowledge: ActivationCheckDto & { productsCount: number; faqCount: number };
  aiContext: ActivationCheckDto;
}
export interface ActivationReadinessResponseDto {
  merchantId: string;
  ready: boolean;
  aiEnabled: boolean;
  activatedAt: string | null;
  checks: ActivationChecksDto;
  channel: { platform: "LINE"; connected: boolean; displayName: string; channelUuid: string | null };
  aiSummary: { assistantName: string; tone: string; fallbackBehavior: string };
}
export interface ActivationResponseDto {
  success: true;
  aiEnabled: boolean;
  alreadyEnabled?: boolean;
  alreadyDisabled?: boolean;
  activatedAt: string | null;
}
// Mutations accept only an empty JSON object (enforced before global whitelisting).
export class ActivationCommandDto {}
