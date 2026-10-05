import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
export class InvalidLineCredentials extends BadRequestException {
  constructor() { super("LINE credentials could not be verified"); }
}
export interface LineCredentials { externalChannelId: string; channelSecret: string; channelAccessToken: string }
export interface VerifiedLineCredentials { botUserId: string }
export interface LineDelivery { outcome: "delivered" | "rejected" | "unknown"; statusCode?: number }
export class LineProviderAdapter {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await this.fetcher("https://api.line.me" + path, {
        ...init, signal: controller.signal, redirect: "error", cache: "no-store",
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status >= 400 && response.status < 500 && response.status !== 429) throw new InvalidLineCredentials();
        throw new ServiceUnavailableException("LINE verification is temporarily unavailable");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new InvalidLineCredentials();
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > 16384) { await reader.cancel(); throw new InvalidLineCredentials(); }
        chunks.push(chunk.value);
      }
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new InvalidLineCredentials();
      return value as Record<string, unknown>;
    } catch (error) {
      if (error instanceof InvalidLineCredentials) throw error;
      throw new ServiceUnavailableException("LINE verification is temporarily unavailable");
    } finally { clearTimeout(timeout); }
  }
  async verify(input: LineCredentials): Promise<VerifiedLineCredentials> {
    // Deploy-time opt-in requires separately authorized live provider operations.
    if (process.env.LINE_CREDENTIAL_VERIFICATION_ENABLED !== "true")
      throw new ServiceUnavailableException("Live LINE credential verification is not enabled");
    // POST keeps the supplied access token out of URL/query parameters.
    // Only short-/long-lived v2 tokens are supported here; never fall back to v2.1 GET.
    const token = await this.request("/v2/oauth/verify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: input.channelAccessToken }),
    });
    if (String(token.client_id) !== input.externalChannelId || typeof token.expires_in !== "number" || token.expires_in <= 0)
      throw new InvalidLineCredentials();
    // Stateless issuance proves the channel secret. Ephemeral result is discarded;
    // it neither rotates nor persists the supplied merchant token.
    const secret = await this.request("/oauth2/v3/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: input.externalChannelId, client_secret: input.channelSecret }),
    });
    if (typeof secret.access_token !== "string" || !secret.access_token || secret.token_type !== "Bearer")
      throw new InvalidLineCredentials();
    const bot = await this.request("/v2/bot/info", {
      method: "GET", headers: { Authorization: "Bearer " + input.channelAccessToken },
    });
    if (typeof bot.userId !== "string" || !/^U[0-9a-f]{32}$/.test(bot.userId)) throw new InvalidLineCredentials();
    return { botUserId: bot.userId };
  }
  async reply(accessToken: string, replyToken: string, text: string): Promise<LineDelivery> {
    if (process.env.LINE_REPLY_ENABLED !== "true") throw new ServiceUnavailableException("Live LINE replies are not enabled");
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await this.fetcher("https://api.line.me/v2/bot/message/reply", {
        method: "POST", signal: controller.signal, redirect: "error", cache: "no-store",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
      });
      await response.body?.cancel();
      return { outcome: response.ok ? "delivered" : response.status < 500 ? "rejected" : "unknown", statusCode: response.status };
    } catch { return { outcome: "unknown" }; }
    finally { clearTimeout(timeout); }
  }
}
