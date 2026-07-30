import { formatPersonDisplayName } from "@/lib/auth/admin-user-schemas";
import type { FinanceRecipient } from "@/lib/email/finance-recipients";
import { prisma } from "@/lib/prisma";

/**
 * Fill missing recipient display names from UserProfile (matched by email).
 * Explicit `Name <email>` entries always win.
 */
export async function enrichFinanceRecipientsFromProfiles(
  recipients: FinanceRecipient[]
): Promise<FinanceRecipient[]> {
  const needLookup = [
    ...new Set(
      recipients.filter((r) => !r.name?.trim()).map((r) => r.email.toLowerCase())
    ),
  ];
  if (needLookup.length === 0) return recipients;

  let profiles: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  }[] = [];
  try {
    profiles = await prisma.userProfile.findMany({
      where: { email: { in: needLookup } },
      select: { email: true, firstName: true, lastName: true },
    });
  } catch (e) {
    console.warn("enrichFinanceRecipientsFromProfiles lookup failed", e);
    return recipients;
  }

  const byEmail = new Map<string, string>();
  for (const p of profiles) {
    const email = p.email?.toLowerCase();
    if (!email) continue;
    const display = formatPersonDisplayName(p.firstName, p.lastName);
    if (display) byEmail.set(email, display);
  }

  if (byEmail.size === 0) return recipients;

  return recipients.map((r) => {
    if (r.name?.trim()) return r;
    const fromProfile = byEmail.get(r.email.toLowerCase());
    return fromProfile ? { ...r, name: fromProfile } : r;
  });
}
