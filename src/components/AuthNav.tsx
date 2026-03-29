"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthNav() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
    });
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!email) return null;

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-3 border-t border-black/10 pt-3 text-xs sm:border-0 sm:pt-0 md:w-auto md:border-0">
      <span className="max-w-[200px] truncate text-black/55" title={email}>
        {email}
      </span>
      <button
        type="button"
        onClick={() => signOut()}
        className="font-heading font-semibold uppercase tracking-wide text-brand hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}
