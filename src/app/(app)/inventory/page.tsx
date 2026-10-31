"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { BoardSkeleton } from "@/components/Skeleton";
import { EditAssetModal } from "@/components/EditAssetModal";
import { LogRepairModal } from "@/components/LogRepairModal";
import { StartAssessmentModal } from "@/components/StartAssessmentModal";
import { useToast } from "@/components/ToastProvider";
import { WriteOffModal } from "@/components/WriteOffModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { BoardCard, type BoardCardActions } from "@/components/board/BoardCard";
import { BoardFilterBar } from "@/components/board/BoardFilterBar";
import { MoveAssetDialog } from "@/components/board/MoveAssetDialog";
import {
  BOARD_STAGE_ORDER,
  STAGE_DOT,
  openAssessment,
  type BoardAsset,
  type BoardStatus,
} from "@/components/board/types";
import { HARDWARE_CREATED_EVENT, openAddHardware } from "@/lib/client/add-hardware";
import {
  EMPTY_BOARD_FILTERS,
  boardFilterOptions,
  hasActiveBoardFilters,
  matchesBoardFilters,
  type BoardFilters,
} from "@/lib/inventory/board-filters";
import { boardDropAction } from "@/lib/inventory/hardware-board-moves";

type AssessmentRef = { id: string; referenceNumber: string };

/** When GET /api/statuses fails, columns still render using status embedded on each asset. */
function deriveStatusesFromAssets(assets: BoardAsset[]): BoardStatus[] {
  const map = new Map<string, BoardStatus>();
  for (const a of assets) {
    if (a.status && !map.has(a.status.id)) map.set(a.status.id, a.status);
  }
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

function intakeRef(asset: BoardAsset): AssessmentRef | null {
  const o = openAssessment(asset);
  return asset.status.code === "assessment" && o
    ? { id: o.id, referenceNumber: o.referenceNumber }
    : null;
}

export default function InventoryPage() {
  const toast = useToast();
  const [assets, setAssets] = useState<BoardAsset[]>([]);
  const [statuses, setStatuses] = useState<BoardStatus[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusesFallback, setStatusesFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_BOARD_FILTERS);

  const [repairAsset, setRepairAsset] = useState<BoardAsset | null>(null);
  const [repairAssessment, setRepairAssessment] = useState<AssessmentRef | null>(null);
  const [writeOffAsset, setWriteOffAsset] = useState<BoardAsset | null>(null);
  const [writeOffAssessment, setWriteOffAssessment] = useState<AssessmentRef | null>(null);
  const [assessAsset, setAssessAsset] = useState<BoardAsset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BoardAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    asset: BoardAsset;
    target: BoardStatus | null;
  } | null>(null);
  const [dragging, setDragging] = useState<BoardAsset | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetchError(null);
    setStatusesFallback(false);
    const [aRes, sRes] = await Promise.all([
      fetch("/api/assets?limit=1000"),
      fetch("/api/statuses"),
    ]);

    if (!aRes.ok) {
      const j = (await aRes.json().catch(() => ({}))) as { error?: string };
      setAssets([]);
      setStatuses([]);
      setFetchError(
        aRes.status === 403
          ? "You don’t have permission to load assets (hardware board needs an admin or operations role). Use Dashboard / Reports if you only have reports access."
          : typeof j.error === "string"
            ? j.error
            : `Could not load assets (${aRes.status}).`
      );
      return;
    }

    const aJson = (await aRes.json()) as { assets?: BoardAsset[] };
    setAssets(Array.isArray(aJson.assets) ? aJson.assets : []);

    if (!sRes.ok) {
      const j = (await sRes.json().catch(() => ({}))) as { error?: string };
      setStatuses([]);
      setStatusesFallback(true);
      setFetchError(
        sRes.status === 403
          ? "Lifecycle statuses were blocked (403). Columns below are derived from your assets so cards still appear."
          : typeof j.error === "string"
            ? `Lifecycle statuses: ${j.error}. Columns are derived from loaded assets.`
            : `Could not load statuses (${sRes.status}); columns derived from assets.`
      );
      return;
    }

    const sJson = await sRes.json();
    setStatuses(Array.isArray(sJson) ? (sJson as BoardStatus[]) : []);
  }, []);

  useEffect(() => {
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const onCreated = () => void load().catch(console.error);
    window.addEventListener(HARDWARE_CREATED_EVENT, onCreated);
    return () => window.removeEventListener(HARDWARE_CREATED_EVENT, onCreated);
  }, [load]);

  const effectiveStatuses = useMemo(
    () => (statuses.length > 0 ? statuses : deriveStatusesFromAssets(assets)),
    [statuses, assets]
  );

  const stages = useMemo(() => {
    const byCode = new Map(effectiveStatuses.map((s) => [s.code, s]));
    return BOARD_STAGE_ORDER.map((code) => byCode.get(code)).filter(
      (s): s is BoardStatus => Boolean(s)
    );
  }, [effectiveStatuses]);

  const filterOptions = useMemo(() => boardFilterOptions(assets, filters), [assets, filters]);

  const filteredAssets = useMemo(
    () => assets.filter((a) => matchesBoardFilters(a, filters)),
    [assets, filters]
  );

  const byStatus = useMemo(() => {
    const m = new Map<string, BoardAsset[]>();
    for (const a of filteredAssets) {
      const list = m.get(a.status.id);
      if (list) list.push(a);
      else m.set(a.status.id, [a]);
    }
    return m;
  }, [filteredAssets]);

  const stageTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assets) m.set(a.status.id, (m.get(a.status.id) ?? 0) + 1);
    return m;
  }, [assets]);

  const filtersActive = hasActiveBoardFilters(filters);

  const updateAssetStatus = useCallback(
    async (asset: BoardAsset, target: BoardStatus): Promise<boolean> => {
      setSavingId(asset.id);
      try {
        const res = await fetch(`/api/assets/${asset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statusId: target.id }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(typeof j.error === "string" ? j.error : "Move failed");
        }
        const updated = (await res.json()) as BoardAsset;
        setAssets((prev) =>
          prev.map((x) =>
            x.id === asset.id
              ? {
                  ...x,
                  ...updated,
                  status: updated.status ?? target,
                  assessments: target.code === "assessment" ? x.assessments : [],
                }
              : x
          )
        );
        toast.showSuccess(`Moved ${asset.assetName} to ${target.label}.`);
        return true;
      } catch (e) {
        console.error(e);
        toast.showError(e instanceof Error ? e.message : "Move failed");
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [toast]
  );

  const openRepair = useCallback((asset: BoardAsset) => {
    setRepairAsset(asset);
    setRepairAssessment(intakeRef(asset));
  }, []);

  const openWriteOff = useCallback((asset: BoardAsset) => {
    setWriteOffAsset(asset);
    setWriteOffAssessment(intakeRef(asset));
  }, []);

  /** Shared by drag-and-drop and "Move to…": confirm plain moves, hand workflow stages to their forms. */
  const requestMove = useCallback(
    (asset: BoardAsset, target: BoardStatus) => {
      const action = boardDropAction(asset.status.code, target.code);
      if (action === null) return;
      if (action === "confirm") {
        setPendingMove({ asset, target });
        return;
      }
      setPendingMove(null);
      if (action === "assessment") setAssessAsset(asset);
      else if (action === "repair") openRepair(asset);
      else openWriteOff(asset);
    },
    [openRepair, openWriteOff]
  );

  const cancelOpenAssessment = useCallback(
    async (asset: BoardAsset) => {
      const o = openAssessment(asset);
      if (!o) {
        toast.showError(
          "No open Assessment/Maintenance intake is linked on this card. Refresh if this looks wrong."
        );
        return;
      }
      if (
        !window.confirm(
          `Cancel Assessment/Maintenance intake (${o.referenceNumber})? The unit moves back to Deployed unless you change stage again.`
        )
      ) {
        return;
      }
      setSavingId(asset.id);
      try {
        const res = await fetch(`/api/assessments/${encodeURIComponent(o.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Cancel failed");
        await load();
      } catch (e) {
        console.error(e);
        toast.showError(e instanceof Error ? e.message : "Cancel failed");
      } finally {
        setSavingId(null);
      }
    },
    [load, toast]
  );

  const cardActions = useMemo<BoardCardActions>(
    () => ({
      onEdit: (a) => setEditingId(a.id),
      onMoveTo: (a) => setPendingMove({ asset: a, target: null }),
      onStartAssessment: (a) => setAssessAsset(a),
      onLogRepair: openRepair,
      onCancelAssessment: (a) => void cancelOpenAssessment(a),
      onWriteOff: openWriteOff,
      onDelete: (a) => setPendingDelete(a),
      onDragStart: (a) => setDragging(a),
      onDragEnd: () => {
        setDragging(null);
        setDropTargetId(null);
      },
    }),
    [openRepair, openWriteOff, cancelOpenAssessment]
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.showError(typeof j.error === "string" ? j.error : "Delete failed");
        return;
      }
      setPendingDelete(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, load, toast]);

  if (loading) {
    return <BoardSkeleton />;
  }

  return (
    <main className="space-y-4 px-4 py-5 lg:px-6">
      <PageHeader
        title="Hardware board"
        description="Move hardware through each lifecycle stage."
        help={
          <>
            Each column is a lifecycle stage. Drag a card to another column, or use{" "}
            <strong>Move to…</strong> in its ⋯ menu; every move asks for confirmation and is
            written to the audit log. <strong>Deployed</strong> field returns go through{" "}
            <strong>Assessment/Maintenance</strong> before <strong>In repairs</strong> when a
            formal repair record is needed. <strong>New Stock</strong> and{" "}
            <strong>Refurbished</strong> are the distributable stages; the dashboard rolls both
            into <strong>Available to distribute</strong>. Templates and clubs are managed in{" "}
            <strong>Settings</strong>.
          </>
        }
        actions={
          <button type="button" onClick={openAddHardware} className="btn-primary">
            <Plus className="h-5 w-5" aria-hidden />
            Add hardware
          </button>
        }
      />

      {fetchError ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">{fetchError}</p>
          {statusesFallback && assets.length > 0 ? (
            <p className="mt-2 text-amber-900/90">
              Your devices are still listed below using stage data stored on each asset.
            </p>
          ) : null}
        </div>
      ) : null}

      {assets.length > 0 ? (
        <BoardFilterBar
          filters={filters}
          options={filterOptions}
          shown={filteredAssets.length}
          total={assets.length}
          onChange={setFilters}
        />
      ) : null}

      {!fetchError && assets.length > 0 && stages.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          No matching lifecycle columns for these assets. Check Settings or re-run{" "}
          <code className="rounded bg-black/5 px-1">npm run db:seed</code> so status codes
          (new_stock, deployed, …) exist.
        </p>
      ) : null}

      <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6 xl:mx-0 xl:grid xl:snap-none xl:grid-cols-6 xl:gap-2 xl:overflow-visible xl:px-0 xl:pb-0"
        aria-label="Lifecycle stages"
      >
        {stages.map((st) => {
          const cards = byStatus.get(st.id) ?? [];
          const total = stageTotals.get(st.id) ?? 0;
          const dropAction = dragging ? boardDropAction(dragging.status.code, st.code) : null;
          const isSource = dragging?.status.id === st.id;
          const isOver = dropTargetId === st.id && dropAction !== null;

          return (
            <section
              key={st.id}
              aria-label={`${st.label}: ${cards.length} ${filtersActive ? `of ${total} ` : ""}${
                (filtersActive ? total : cards.length) === 1 ? "unit" : "units"
              }`}
              onDragOver={(e) => {
                if (!dragging || dropAction === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropTargetId !== st.id) setDropTargetId(st.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDropTargetId((id) => (id === st.id ? null : id));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const asset = dragging;
                setDragging(null);
                setDropTargetId(null);
                if (asset) requestMove(asset, st);
              }}
              className={`flex h-[min(70dvh,640px)] w-[78vw] max-w-[20rem] shrink-0 snap-start flex-col overflow-hidden rounded-lg border bg-white transition-colors sm:w-64 xl:h-[calc(100dvh-17rem)] xl:min-h-[24rem] xl:w-auto xl:max-w-none xl:min-w-0 ${
                isOver
                  ? "border-hna-green-strong ring-2 ring-brand/40"
                  : dragging && dropAction !== null
                    ? "border-dashed border-brand"
                    : "border-line"
              } ${dragging && dropAction === null && !isSource ? "opacity-50" : ""}`}
            >
              <header
                className="sticky top-0 z-[1] flex items-center gap-1.5 border-b border-line bg-white px-2.5 py-2.5"
                title={st.description ?? undefined}
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${STAGE_DOT[st.code] ?? "bg-neutral-400"}`}
                  aria-hidden
                />
                <h2 className="line-clamp-2 min-w-0 flex-1 break-words text-[13px] font-semibold leading-tight text-ink">
                  {st.label.replaceAll("/", "/\u200b")}
                </h2>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-muted">
                  {filtersActive && cards.length !== total ? `${cards.length}/${total}` : cards.length}
                </span>
              </header>
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-surface/60 p-2">
                {cards.map((asset) => (
                  <li key={asset.id}>
                    <BoardCard asset={asset} busy={savingId === asset.id} actions={cardActions} />
                  </li>
                ))}
                {cards.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-line px-2 py-6 text-center text-xs text-muted">
                    {total === 0 ? "Nothing in this stage." : "No matches for these filters."}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      {pendingMove ? (
        <MoveAssetDialog
          asset={pendingMove.asset}
          stages={stages}
          target={pendingMove.target}
          busy={savingId === pendingMove.asset.id}
          onChoose={(target) => requestMove(pendingMove.asset, target)}
          onCancel={() => setPendingMove(null)}
          onConfirm={() => {
            const { asset, target } = pendingMove;
            if (!target) return;
            void updateAssetStatus(asset, target).then((ok) => {
              if (ok) setPendingMove(null);
            });
          }}
        />
      ) : null}

      <StartAssessmentModal
        asset={assessAsset}
        onClose={() => setAssessAsset(null)}
        onSuccess={() => void load()}
      />
      <LogRepairModal
        asset={repairAsset}
        assessmentId={repairAssessment?.id}
        assessmentReference={repairAssessment?.referenceNumber}
        onClose={() => {
          setRepairAsset(null);
          setRepairAssessment(null);
        }}
        onSuccess={() => void load()}
      />
      <WriteOffModal
        asset={writeOffAsset}
        assessmentId={writeOffAssessment?.id}
        assessmentReference={writeOffAssessment?.referenceNumber}
        onClose={() => {
          setWriteOffAsset(null);
          setWriteOffAssessment(null);
        }}
        onSuccess={() => void load()}
      />

      {editingId ? (
        <EditAssetModal
          assetId={editingId}
          statuses={effectiveStatuses.map((s) => ({ id: s.id, code: s.code, label: s.label }))}
          onClose={() => {
            setEditingId(null);
            void load();
          }}
          onSaved={() => {
            setEditingId(null);
            void load();
          }}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete asset?"
        itemName={pendingDelete?.assetName ?? ""}
        itemDetail={pendingDelete?.serialNumber ? `S/N ${pendingDelete.serialNumber}` : "No serial number"}
        consequence="This removes the asset from the register. It cannot be undone."
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </main>
  );
}
