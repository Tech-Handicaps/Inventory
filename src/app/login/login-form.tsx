"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandSplashGate } from "@/components/BrandSplashGate";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectPath(searchParams.get("redirect"), "/inventory");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        setError(signError.message);
        return;
      }
      router.push(redirect);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BrandSplashGate>
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-muted via-white to-surface"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -top-10 h-80 w-80 rounded-full bg-brand/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandLogo className="h-20 w-auto sm:h-24" priority />
            <p className="font-heading mt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-hover">
              Handicaps Network Africa
            </p>
            <h1 className="font-heading mt-2 text-2xl font-bold uppercase tracking-tight text-black">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-black/60">
              Inventory Tracker — secure access for your team
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-black/10 bg-white/90 p-8 shadow-lg shadow-brand/5 backdrop-blur-sm"
          >
            {error ? (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div>
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wide text-black/70"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@handicaps.co.za"
                className="mt-2 w-full rounded-xl border border-black/15 bg-surface/40 px-4 py-3 text-sm outline-none ring-brand/25 transition focus:border-brand/50 focus:bg-white focus:ring-2"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wide text-black/70"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-black/15 bg-surface/40 px-4 py-3 text-sm outline-none ring-brand/25 transition focus:border-brand/50 focus:bg-white focus:ring-2"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="font-heading w-full rounded-xl bg-brand py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-brand/20 transition hover:bg-brand-hover disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-black/50">
            <Link href="/" className="font-medium text-brand hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </BrandSplashGate>
  );
}
