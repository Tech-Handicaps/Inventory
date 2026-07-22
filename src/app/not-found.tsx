import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-zinc-900">
        Page not found
      </h1>
      <p className="text-sm leading-relaxed text-zinc-600">
        The page you requested does not exist or has been moved.
      </p>
      <Link
        href="/inventory"
        className="text-sm font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
      >
        Go to inventory
      </Link>
    </main>
  );
}
