import { cookies } from "next/headers";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  globalRole: string;
  status: string;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get("chatto_session")?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const apiUrl = (process.env.API_INTERNAL_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
  const response = await fetch(`${apiUrl}/auth/profile`, {
    headers: { Cookie: `chatto_session=${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to check your session. Please try again.");
  const result = await response.json() as { user: AuthUser };
  return result.user;
}
