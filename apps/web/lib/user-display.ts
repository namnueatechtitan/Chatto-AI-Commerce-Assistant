export function getUserDisplayName(user: { name?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }): string {
  const fullName = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(" ");
  const name = fullName || user.name?.trim();
  return name && name !== user.email ? name : "ผู้ใช้งาน Chatto";
}
