import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

export interface Merchant {
  id: string;
  shopName: string;
  slug: string;
  status: string;
}

export interface MerchantMembership {
  merchant: Merchant;
  role: { name: string };
}

async function merchantRequest(path: string): Promise<Response> {
  const token = (await cookies()).get("chatto_session")?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) redirect("/login");
  const apiUrl = (process.env.API_INTERNAL_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
  const response = await fetch(`${apiUrl}/merchants${path}`, {
    headers: { Cookie: `chatto_session=${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) redirect("/login");
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Unable to load your shops. Please try again.");
  return response;
}

export async function getMyMerchants(): Promise<MerchantMembership[]> {
  const response = await merchantRequest("");
  const result = await response.json() as { memberships: MerchantMembership[] };
  return result.memberships;
}

export async function getMyMerchant(id: string): Promise<MerchantMembership & {
  owners: { user: { id: string; name: string } }[];
}> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const response = await merchantRequest(`/${id}`);
  return response.json();
}
