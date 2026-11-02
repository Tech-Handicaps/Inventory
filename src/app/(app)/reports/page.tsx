import { PageHeader } from "@/components/ui/PageHeader";
import { ReportsTabs } from "./reports-tabs";
import { parseReportsTab } from "./tabs";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  return (
    <main className="mx-auto max-w-7xl p-6 pb-16">
      <PageHeader
        title="Reports"
        description="Finance packs, stock counts, audit history and asset movements. All times are SAST."
      />
      <ReportsTabs initialTab={parseReportsTab(tab)} />
    </main>
  );
}
