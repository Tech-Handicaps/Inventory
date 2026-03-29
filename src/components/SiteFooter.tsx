export function SiteFooter() {
  return (
    <footer
      className="mt-auto border-t border-black/10 bg-white"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="h-px w-full max-w-md bg-brand" aria-hidden />
        <div className="mt-6 space-y-3 text-center sm:text-left">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-black">
            Inventory Tracker
          </p>
          <p className="text-sm leading-relaxed text-black/70">
            Designed by{" "}
            <span className="font-medium text-black">
              Mogamat Shafiek Christian
            </span>{" "}
            for{" "}
            <span className="font-medium text-brand">Handicaps Network Africa</span>
            .
          </p>
          <p className="text-xs leading-relaxed text-black/55">
            © 2026 Digital Fingers Pty Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
