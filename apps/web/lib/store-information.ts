import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { StoreInformation } from "./store-information-types";
export async function getStoreInformation(merchantId: string): Promise<StoreInformation> {
  const token = (await cookies()).get("chatto_session")?.value;
  if (!token) redirect("/login");
  const api = (process.env.API_INTERNAL_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
  const response = await fetch(`${api}/merchants/${encodeURIComponent(merchantId)}/information`, { headers: { Cookie: `chatto_session=${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (response.status === 401) redirect("/login");
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Unable to load store information. Please retry.");
  return response.json() as Promise<StoreInformation>;
}
