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
      <p className="mt-4 max-w-lg text-center text-base leading-relaxed text-black/70">
        Track hardware through each stage — new stock, in stock, in repairs,
        and refurbished — with dashboards and optional financial sync.
      </p>
      <p className="mt-3 max-w-md text-center text-sm text-black/55">
        After you sign in, use the navigation bar to open the hardware board,
        dashboard, assets, reports, and settings.
      </p>
      <div className="mt-10 flex justify-center">
        <Link
          href="/login"
          className="font-heading inline-flex min-w-[12rem] items-center justify-center rounded-lg bg-brand px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-brand-hover"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
