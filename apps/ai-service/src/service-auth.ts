import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { productionServiceCredentialsValid } from "./service-token-policy";

export function configuredServiceToken(name: "AI_SERVICE_TOKEN" | "INTERNAL_SERVICE_TOKEN"): string {
  const token = process.env[name]?.trim();
  if (!token || !productionServiceCredentialsValid()) throw new Error("Service authentication is not configured");
  return token;
}

export function hasValidServiceToken(request: Request): boolean {
  const expected = process.env.AI_SERVICE_TOKEN?.trim();
  const provided = /^Bearer ([^\s]+)$/.exec(request.headers.authorization ?? "")?.[1];
  return Boolean(productionServiceCredentialsValid() && expected && provided && timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest(),
  ));
}

export function requireServiceToken(request: Request, response: Response, next: NextFunction): void {
  if (!process.env.AI_SERVICE_TOKEN?.trim() || !productionServiceCredentialsValid()) {
    response.status(503).json({ error: { code: "SERVICE_AUTH_UNAVAILABLE", message: "Service authentication is not configured." } });
    return;
  }
  if (!hasValidServiceToken(request)) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid AI service token." } });
    return;
  }
  response.setHeader("Cache-Control", "private, no-store");
  next();
}
