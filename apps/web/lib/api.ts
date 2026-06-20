import type { LiveMessage } from "../types/live-message";

const DEFAULT_API_BASE_URL = "http://localhost:4000";

function getApiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

  return baseUrl.replace(/\/+$/, "");
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getLatestMessages() {
  return fetchJson<LiveMessage[]>("/conversations/messages/latest");
}
