// Only an explicitly configured public HTTPS endpoint may be displayed.
// This checks URL shape; the deployment owner must supply a real deployed endpoint.
export function publicLineWebhookUrl(configured: string | undefined): string | null {
  if (!configured?.trim()) return null;
  try {
    const url = new URL(configured.trim());
    const host = url.hostname.toLowerCase();
    const publicDomain = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host);
    const reservedDomain = /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)
      || /(?:^|\.)example\.(?:com|net|org)$/.test(host);
    if (url.protocol !== "https:" || !publicDomain || reservedDomain
      || url.username || url.password || url.search || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

// Configuration is the deployed route prefix, e.g. https://<host>/webhooks/line.
// Never expose the old global URL or synthesize a production hostname.
export function channelWebhookUrl(configuredPrefix: string | null, channelId?: string): string | null {
  if (!configuredPrefix || !channelId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId)) return null;
  const prefix = publicLineWebhookUrl(configuredPrefix);
  if (!prefix || !new URL(prefix).pathname.replace(/\/+$/, "").endsWith("/webhooks/line")) return null;
  return prefix.replace(/\/+$/, "") + "/" + channelId;
}
