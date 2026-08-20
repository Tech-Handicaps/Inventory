import type { User } from "@supabase/supabase-js";

/** First name or friendly label for greetings (never the full email). */
export function displayNameFromUser(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const candidates = [meta?.full_name, meta?.name, meta?.display_name];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const first = c.trim().split(/\s+/)[0];
      if (first) return capitalize(first);
    }
  }

  const email = user.email?.split("@")[0] ?? "";
  const token = email.split(/[._-]/)[0];
  if (token) return capitalize(token);
  return "there";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
