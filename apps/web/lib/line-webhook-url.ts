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
