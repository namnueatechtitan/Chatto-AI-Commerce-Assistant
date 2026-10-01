import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import type { CookieOptions, Request } from "express";

export function webOrigin(): string {
  const value = process.env.WEB_URL?.trim();
  if (!value && process.env.NODE_ENV === "production") {
    throw new ServiceUnavailableException("WEB_URL is not configured");
  }
  const url = new URL(value || "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !local)) {
    throw new ServiceUnavailableException("Invalid WEB_URL");
  }
  return url.origin;
}

export function requireWebOrigin(request: Request): void {
  if (request.headers.origin !== webOrigin()) throw new ForbiddenException("Invalid request origin");
}

export function cookieOptions(): CookieOptions {
  return { httpOnly: true, secure: webOrigin().startsWith("https:"), sameSite: "lax", path: "/" };
}

export function readCookie(request: Request, name: string): string | undefined {
  const value = request.headers.cookie?.split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
