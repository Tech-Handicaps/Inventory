"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandSplashGate } from "@/components/BrandSplashGate";

export default function HomePage() {
  return (
    <BrandSplashGate>
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-muted via-white to-surface"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-brand/10 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
          <BrandLogo className="h-20 w-auto sm:h-24" priority />
          <p className="font-heading mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-hover">
            Handicaps Network Africa
          </p>
          <h1 className="font-heading mt-3 text-3xl font-bold uppercase tracking-tight text-black sm:text-4xl">
            Hardware inventory
          </h1>
          <p className="mt-4 text-base leading-relaxed text-black/65">
            Track hardware through each stage — new stock, field deployment,
            repairs, and refurbishment — with dashboards and finance-ready
            reports.
          </p>
          <Link
            href="/login"
            prefetch={false}
            className="font-heading mt-10 inline-flex min-w-[14rem] items-center justify-center rounded-xl bg-brand px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-brand/25 transition hover:bg-brand-hover hover:shadow-lg"
          >
            Sign in
          </Link>
        </div>
      </div>
    </BrandSplashGate>
  );
}
