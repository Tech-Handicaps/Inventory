import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requirePublicEnv(name: string, value: string | undefined): string {
  if (value == null || String(value).trim() === "") {
    throw new Error(
      `${name} is not set. Add it in Vercel → Project → Settings → Environment Variables (Production & Preview).`
    );
  }
  return value;
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  const url = requirePublicEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const key = requirePublicEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_* )",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}
