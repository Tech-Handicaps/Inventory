import Link from "next/link";

export default function NotFound() {
  return (
    <main className="entry-canvas mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-6 py-16">
      <span className="funky-badge w-fit">404</span>
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight brand-gradient-text">
        Page not found
      </h1>
      <p className="text-sm leading-relaxed text-black/65">
        The page you requested does not exist or has been moved.
      </p>
      <Link href="/inventory" className="btn-primary w-fit">
        Go to inventory
      </Link>
    </main>
  );
}
