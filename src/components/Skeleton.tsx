type BlockProps = {
  className?: string;
};

export function SkeletonBlock({ className = "" }: BlockProps) {
  return <div className={`animate-pulse rounded-md bg-black/[0.06] ${className}`} aria-hidden />;
}

function SkeletonHeader() {
  return (
    <div className="space-y-3">
      <SkeletonBlock className="h-3 w-28" />
      <SkeletonBlock className="h-7 w-72 max-w-full" />
      <SkeletonBlock className="h-4 w-[32rem] max-w-full" />
    </div>
  );
}

function SkeletonCard({ className = "" }: BlockProps) {
  return (
    <div className={`rounded-lg border border-[#e5e9ec] bg-white p-4 ${className}`}>
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-3 h-7 w-16" />
    </div>
  );
}

export function SkeletonRows({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} className="h-9 w-full" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      <SkeletonBlock className="h-4 w-64 max-w-full" />
      <div className="rounded-lg border border-[#e5e9ec] bg-white p-4">
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBlock key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <main className="space-y-4 overflow-hidden px-4 py-5 lg:px-6" role="status" aria-label="Loading hardware board">
      <SkeletonHeader />
      <SkeletonBlock className="h-24 w-full" />
      <div className="flex gap-3 xl:grid xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, col) => (
          <div key={col} className="w-64 shrink-0 rounded-lg border border-[#e5e9ec] bg-white p-3 xl:w-auto xl:min-w-0">
            <SkeletonBlock className="h-4 w-24" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonBlock key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading hardware board</span>
    </main>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6" role="status" aria-label="Loading dashboard">
      <SkeletonHeader />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-64 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
      <span className="sr-only">Loading dashboard</span>
    </main>
  );
}

export function TablePageSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6" role="status" aria-label={label}>
      <SkeletonHeader />
      <div className="rounded-lg border border-[#e5e9ec] bg-white p-4">
        <SkeletonBlock className="h-9 w-full" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <SkeletonBlock key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </main>
  );
}

export function ReportsSkeleton() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6" role="status" aria-label="Loading reports">
      <SkeletonHeader />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonBlock key={i} className="h-8 w-28" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} className="h-28" />
        ))}
      </div>
      <SectionSkeleton label="Loading report" />
      <span className="sr-only">Loading reports</span>
    </main>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading settings">
      <SkeletonHeader />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonBlock key={i} className="h-8 w-28" />
        ))}
      </div>
      <SectionSkeleton label="Loading settings section" />
      <span className="sr-only">Loading settings</span>
    </div>
  );
}
