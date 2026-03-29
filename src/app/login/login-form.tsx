"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_EMAIL = "shafiek@handicaps.co.za";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/inventory";

  const [email, setEmail] = useState(DEFAULT_EMAIL);
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
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center">
          <BrandLogo className="h-20 w-auto sm:h-24" priority />
          <div className="mt-8 h-1 w-24 rounded-full bg-brand" aria-hidden />
        </div>

        <h1 className="font-heading text-center text-xl font-bold uppercase tracking-tight text-black">
          Sign in
        </h1>
        <p className="mt-2 text-center text-sm text-black/60">
          Inventory Tracker — Handicaps Network Africa
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-5 rounded-xl border border-black/10 bg-surface/50 p-8 shadow-sm"
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
              className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3 text-sm"
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
              className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="font-heading w-full rounded-lg bg-brand py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-black/50">
          <Link href="/" className="text-brand hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
