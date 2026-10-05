import { createHash, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { productionServiceCredentialsValid } from "./service-token-policy";

export function configuredServiceToken(name: "INTERNAL_SERVICE_TOKEN" | "AI_SERVICE_TOKEN"): string {
  const token = process.env[name]?.trim();
  if (!token || !productionServiceCredentialsValid()) throw new ServiceUnavailableException("Service authentication is not configured");
  return token;
}

export function assertServiceToken(authorization: string | undefined): void {
  const expected = configuredServiceToken("INTERNAL_SERVICE_TOKEN");
  const provided = /^Bearer ([^\s]+)$/.exec(authorization ?? "")?.[1];
  if (!provided || !timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest(),
  )) throw new UnauthorizedException("Missing or invalid internal service token");
}
