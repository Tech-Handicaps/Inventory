"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function HomePage() {
  return (
    <div className="entry-canvas relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div
        className="entry-blob -right-24 top-10 h-80 w-80 bg-brand/20"
        aria-hidden
      />
      <div
        className="entry-blob -left-16 bottom-0 h-72 w-72 bg-brand/12"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <BrandLogo className="h-20 w-auto sm:h-24" priority />
        <span className="funky-badge mt-8">
          <span className="funky-badge-dot" aria-hidden />
          Handicaps Network Africa
        </span>
        <h1 className="font-heading mt-4 text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          <span className="brand-gradient-text">Hardware inventory</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-black/65">
          Track hardware through each stage — new stock, field deployment,
          repairs, and refurbishment — with dashboards and finance-ready
          reports.
        </p>
        <Link href="/login" prefetch={false} className="btn-primary mt-10 min-w-[14rem]">
          Sign in
        </Link>
      </div>
    </div>
  );
}
