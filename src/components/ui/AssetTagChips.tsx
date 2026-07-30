import { assetTagsForDisplay } from "@/lib/inventory/asset-tags";

type Props = {
  tags?: string[] | null;
  /** Legacy primary category when `tags` is empty */
  category?: string | null;
  size?: "xs" | "sm";
};

export function AssetTagChips({
  tags,
  category,
  size = "sm",
}: Props) {
  const labels = assetTagsForDisplay(tags, category);
  if (labels.length === 0) {
    return <span className="text-black/40">—</span>;
  }

  const chipClass =
    size === "xs"
      ? "rounded-full bg-brand-muted/70 px-1.5 py-px text-[10px] font-medium text-brand-deep ring-1 ring-brand/15"
      : "rounded-full bg-brand-muted/80 px-2 py-0.5 text-[11px] font-medium text-brand-deep ring-1 ring-brand/20";

  return (
    <div className="flex max-w-[14rem] flex-wrap gap-1">
      {labels.map((tag) => (
        <span key={tag} className={chipClass}>
          {tag}
        </span>
      ))}
    </div>
  );
}
