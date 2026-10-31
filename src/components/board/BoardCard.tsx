"use client";

import { memo } from "react";
import { OverflowMenu, type OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { displayAssetModel } from "@/lib/inventory/asset-hardware-display";
import { openAssessment, type BoardAsset } from "@/components/board/types";

export type BoardCardActions = {
  onEdit: (asset: BoardAsset) => void;
  onMoveTo: (asset: BoardAsset) => void;
  onStartAssessment: (asset: BoardAsset) => void;
  onLogRepair: (asset: BoardAsset) => void;
  onCancelAssessment: (asset: BoardAsset) => void;
  onWriteOff: (asset: BoardAsset) => void;
  onDelete: (asset: BoardAsset) => void;
  onDragStart: (asset: BoardAsset) => void;
  onDragEnd: () => void;
};

function Chip({
  tone,
  children,
  title,
}: {
  tone: "amber" | "green" | "neutral";
  children: React.ReactNode;
  title?: string;
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 text-amber-900 ring-amber-300"
      : tone === "green"
        ? "bg-brand-muted text-hna-green-text ring-brand/30"
        : "bg-surface text-ink ring-line";
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}
    >
      {children}
    </span>
  );
}

function menuItems(asset: BoardAsset, a: BoardCardActions): OverflowMenuItem[] {
  const code = asset.status.code;
  const items: OverflowMenuItem[] = [
    { label: "Edit", onSelect: () => a.onEdit(asset) },
    { label: "Move to…", onSelect: () => a.onMoveTo(asset) },
  ];
  if (code === "deployed") {
    items.push({ label: "Send for Assessment/Maintenance", onSelect: () => a.onStartAssessment(asset) });
  } else if (code !== "written_off") {
    items.push({ label: "Log repair", onSelect: () => a.onLogRepair(asset) });
  }
  if (code === "assessment") {
    items.push({ label: "Cancel intake", onSelect: () => a.onCancelAssessment(asset) });
  }
  if (code === "assessment" || code === "repair") {
    items.push({ label: "Write off (cannot repair)", onSelect: () => a.onWriteOff(asset) });
  }
  if (code === "written_off") {
    items.push({
      label: "Download write-off certificate",
      onSelect: () => {
        window.location.href = `/api/assets/${asset.id}/write-off-certificate`;
      },
    });
  }
  items.push({ label: "Delete", destructive: true, onSelect: () => a.onDelete(asset) });
  return items;
}

export const BoardCard = memo(function BoardCard({
  asset,
  busy,
  actions,
}: {
  asset: BoardAsset;
  busy: boolean;
  actions: BoardCardActions;
}) {
  const model = displayAssetModel(asset);
  const intake = asset.status.code === "assessment" ? openAssessment(asset) : null;
  const showReason =
    asset.reason && (asset.status.code === "repair" || asset.status.code === "written_off");

  return (
    <article
      draggable={!busy}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", asset.id);
        actions.onDragStart(asset);
      }}
      onDragEnd={actions.onDragEnd}
      aria-busy={busy}
      className={`rounded-lg border border-line bg-white p-2.5 ${
        busy ? "opacity-60" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <button
        type="button"
        onClick={() => actions.onEdit(asset)}
        className="line-clamp-2 w-full break-words text-left text-sm font-semibold leading-snug text-ink hover:underline"
        title={asset.assetName}
      >
        {asset.assetName}
      </button>
      {model ? (
        <p className="truncate text-xs text-muted" title={model}>
          {model}
        </p>
      ) : null}
      <p className="truncate font-mono text-xs text-ink" title={asset.serialNumber ?? undefined}>
        {asset.serialNumber ?? <span className="font-sans text-muted">No serial</span>}
      </p>
      <p className="truncate text-xs text-ink" title={asset.club?.name}>
        {asset.club?.name ?? <span className="text-muted">No club</span>}
      </p>
      {showReason ? (
        <p className="truncate text-xs text-muted" title={asset.reason ?? undefined}>
          {asset.reason}
        </p>
      ) : null}
      <div className="mt-1.5 flex items-end gap-1">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
        {asset.status.code !== "written_off" && !asset.warrantyEndDate ? (
          <Chip tone="amber" title="No warranty end date recorded">
            Warranty?
          </Chip>
        ) : null}
        {asset.status.code === "assessment" ? (
          intake ? (
            <Chip tone="amber" title="Open Assessment/Maintenance intake">
              {intake.referenceNumber}
            </Chip>
          ) : (
            <Chip tone="amber">No intake</Chip>
          )
        ) : null}
        {asset.dataSource === "zoho_assist" ? (
          <Chip tone="green" title="Linked to Zoho Assist">
            Assist
          </Chip>
        ) : null}
        </div>
        <div className="-mb-1 -mr-1 shrink-0">
          <OverflowMenu label={asset.assetName} disabled={busy} items={menuItems(asset, actions)} />
        </div>
      </div>
    </article>
  );
});
