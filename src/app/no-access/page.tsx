import Link from "next/link";

/**
 * Authenticated users with no assigned application role land here (deny-by-default).
 */
export default function NoAccessPage() {
  return (
    <main className="entry-canvas mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-6 py-16">
      <span className="funky-badge w-fit">Access denied</span>
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight brand-gradient-text">
        No access
      </h1>
      <p className="text-sm leading-relaxed text-black/65">
        Your account is signed in but has not been assigned an application role.
        Ask an administrator to grant access, then try again.
      </p>
      <Link href="/login" className="btn-primary w-fit">
        Back to sign in
      </Link>
    </main>
  );
}
