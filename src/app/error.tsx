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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">
        Something went wrong
      </h1>
      <p className="text-sm leading-relaxed text-zinc-600">
        An unexpected error occurred. You can try again, or go back to the home
        page.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-zinc-400">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded border border-black/15 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-white"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
