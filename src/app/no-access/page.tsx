import Link from "next/link";

/**
 * Authenticated users with no assigned application role land here (deny-by-default).
 */
export default function NoAccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-zinc-900">
        No access
      </h1>
      <p className="text-sm leading-relaxed text-zinc-600">
        Your account is signed in but has not been assigned an application role.
        Ask an administrator to grant access, then try again.
      </p>
      <Link
        href="/login"
        className="text-sm font-medium text-teal-800 underline underline-offset-2 hover:text-teal-950"
      >
        Back to sign in
      </Link>
    </main>
  );
}
