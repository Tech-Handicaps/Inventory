"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app/error", error);
  }, [error]);

  return (
    <main className="entry-canvas mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-6 py-16">
      <span className="funky-badge w-fit">Something went wrong</span>
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight brand-gradient-text">
        Unexpected error
      </h1>
      <p className="text-sm leading-relaxed text-black/65">
        An unexpected error occurred. You can try again, or go back to the home
        page.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-black/40">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => reset()} className="btn-primary">
          Try again
        </button>
        <Link href="/inventory" className="btn-secondary">
          Hardware board
        </Link>
      </div>
    </main>
  );
}
