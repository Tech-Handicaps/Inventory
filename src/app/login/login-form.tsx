"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandSplashGate } from "@/components/BrandSplashGate";
import { PasswordInput } from "@/components/PasswordInput";
import { safeRedirectPath } from "@/lib/http/safe-redirect";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectPath(searchParams.get("redirect"), "/inventory");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof j.error === "string"
            ? j.error
            : "Invalid username/email or password"
        );
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
      <div className="entry-canvas relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="entry-blob -right-20 -top-10 h-80 w-80 bg-brand/20" aria-hidden />
        <div className="entry-blob -bottom-24 -left-10 h-72 w-72 bg-brand/12" aria-hidden />

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandLogo className="h-20 w-auto sm:h-24" priority />
            <span className="funky-badge mt-6">Handicaps Network Africa</span>
            <h1 className="font-heading mt-3 text-2xl font-bold uppercase tracking-tight">
              <span className="brand-gradient-text">Sign in</span>
            </h1>
            <p className="mt-2 text-sm text-black/60">
              Inventory Tracker — use your username or email
            </p>
          </div>

          <form onSubmit={handleSubmit} className="glass-card space-y-5 p-8">
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200/60" role="alert">
                {error}
              </p>
            ) : null}

            <div>
              <label
                htmlFor="identifier"
                className="text-xs font-semibold uppercase tracking-wide text-black/70"
              >
                Username or email
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="jsmith or you@handicaps.co.za"
                className="input-field mt-2 px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wide text-black/70"
              >
                Password
              </label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field mt-2 px-4 py-3 text-sm"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-black/50">
            <Link href="/" className="font-semibold text-brand hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </BrandSplashGate>
  );
}
