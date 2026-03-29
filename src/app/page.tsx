import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12">
      <div className="mb-10 flex flex-col items-center">
        <BrandLogo className="h-16 w-auto sm:h-20" priority />
        <div className="mt-8 h-1 w-24 rounded-full bg-brand" aria-hidden />
      </div>
      <h1 className="font-heading text-center text-2xl font-bold uppercase tracking-tight text-black sm:text-3xl">
        Hardware inventory
      </h1>
      <p className="mb-6 max-w-lg text-center text-base leading-relaxed text-black/70">
        Track hardware through each stage — new stock, in stock, in repairs,
        and refurbished — with dashboards and optional financial sync.
      </p>
      <p className="mb-10 text-center text-sm text-black/55">
        <Link
          href="/login"
          className="font-heading font-semibold text-brand underline decoration-2 underline-offset-4 hover:text-brand-hover"
        >
          Sign in
        </Link>{" "}
        to open the app.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/login"
          className="font-heading rounded-lg bg-brand px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          Sign in
        </Link>
        <Link
          href="/inventory"
          className="font-heading rounded-lg border-2 border-black bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-black hover:text-white"
        >
          Hardware board
        </Link>
        <Link
          href="/dashboard"
          className="font-heading rounded-lg border-2 border-black bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-black hover:text-white"
        >
          Dashboard
        </Link>
        <Link
          href="/assets"
          className="font-heading rounded-lg border-2 border-brand bg-brand-muted px-6 py-3 text-sm font-bold uppercase tracking-wide text-brand transition-colors hover:bg-brand hover:text-white"
        >
          All assets
        </Link>
        <Link
          href="/reports"
          className="font-heading rounded-lg border-2 border-black/20 bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:border-black"
        >
          PDF reports
        </Link>
        <Link
          href="/settings"
          className="font-heading rounded-lg border-2 border-brand/40 bg-brand-muted px-6 py-3 text-sm font-bold uppercase tracking-wide text-brand transition-colors hover:bg-brand hover:text-white"
        >
          Device templates
        </Link>
      </div>
    </div>
  );
}
