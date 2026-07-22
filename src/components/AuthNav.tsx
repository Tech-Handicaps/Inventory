"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";

export function AuthNav() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createClient();
      void supabase.auth
        .getUser()
        .then(({ data: { user }, error }) => {
          if (cancelled) return;
          if (error) {
            console.error("AuthNav getUser", error);
            setEmail(null);
            return;
          }
          setEmail(user?.email ?? null);
        })
        .catch((e) => {
          console.error("AuthNav getUser", e);
          if (!cancelled) setEmail(null);
        });
    } catch (e) {
      console.error("AuthNav client", e);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.showError(error.message || "Sign out failed");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("AuthNav signOut", e);
      toast.showError("Sign out failed");
    }
  }

  if (!email) return null;

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-3 border-t border-black/10 pt-3 text-xs sm:border-0 sm:pt-0 md:w-auto md:border-0">
      <span className="max-w-[200px] truncate text-black/55" title={email}>
        {email}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="font-heading font-semibold uppercase tracking-wide text-brand hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}
