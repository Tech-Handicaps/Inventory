"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { apiErrorMessage } from "@/lib/client/api-error";
import type {
  ManufacturerSpellingFinding,
  PlaceholderTemplateFinding,
  TemplateDuplicateFinding,
  TemplateReviewFinding,
} from "@/lib/inventory/template-duplicates";

type PendingAction =
  | { kind: "merge_templates"; finding: TemplateDuplicateFinding; keepId: string }
  | { kind: "merge_manufacturer"; finding: ManufacturerSpellingFinding; canonical: string }
  | { kind: "remove_placeholder"; finding: PlaceholderTemplateFinding };

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function TemplateDuplicatesPanel({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [findings, setFindings] = useState<TemplateReviewFinding[]>([]);
  const [canResolve, setCanResolve] = useState(false);
  const [loading, setLoading] = useState(true);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/device-templates/duplicates");
    if (!res.ok) {
      toast.showError(await apiErrorMessage(res));
      return;
    }
    const data = (await res.json()) as { findings: TemplateReviewFinding[]; canResolve: boolean };
    setFindings(data.findings);
    setCanResolve(data.canResolve);
  }, [toast]);

  useEffect(() => {
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  async function resolve(body: Record<string, unknown>, key: string): Promise<boolean> {
    setBusyKey(key);
    try {
      const res = await fetch("/api/device-templates/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, key }),
      });
      if (!res.ok) {
        toast.showError(await apiErrorMessage(res));
        return false;
      }
      await load();
      onChanged();
      return true;
    } finally {
      setBusyKey(null);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    const key = pending.finding.key;
    let ok = false;
    if (pending.kind === "merge_templates") {
      ok = await resolve({ action: "merge_templates", keepId: pending.keepId }, key);
    } else if (pending.kind === "merge_manufacturer") {
      ok = await resolve({ action: "merge_manufacturer", canonical: pending.canonical }, key);
    } else {
      setBusyKey(key);
      try {
        const res = await fetch(`/api/device-templates/${pending.finding.template.id}`, {
          method: "DELETE",
        });
        if (!res.ok) toast.showError(await apiErrorMessage(res));
        else {
          ok = true;
          await load();
          onChanged();
        }
      } finally {
        setBusyKey(null);
      }
    }
    if (ok) setPending(null);
  }

  function choiceFor(finding: TemplateReviewFinding): string {
    if (choices[finding.key]) return choices[finding.key];
    if (finding.kind === "template") return finding.templates[0].id;
    if (finding.kind === "manufacturer") return finding.spellings[0].manufacturer;
    return "";
  }

  const keepBothButton = (finding: TemplateReviewFinding, label = "Keep both") =>
    canResolve ? (
      <button
        type="button"
        disabled={busyKey !== null}
        onClick={() => void resolve({ action: "keep_both" }, finding.key)}
        className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-black/[0.04] disabled:opacity-50"
      >
        {label}
      </button>
    ) : null;

  const mergeButton = (onClick: () => void, label = "Merge") =>
    canResolve ? (
      <button
        type="button"
        disabled={busyKey !== null}
        onClick={onClick}
        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {label}
      </button>
    ) : null;

  return (
    <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
      <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
        Possible duplicates{loading ? "" : ` (${findings.length})`}
      </h3>
      <p className="mt-2 text-sm text-black/65">
        Templates that look like the same device typed differently. Nothing is merged or removed
        until an admin chooses an action here.
      </p>

      {loading ? (
        <div className="mt-4">
          <SectionSkeleton label="Checking for duplicates" />
        </div>
      ) : findings.length === 0 ? (
        <p className="mt-4 text-sm text-black/50">No possible duplicates found.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {findings.map((finding) => (
            <li key={finding.key} className="rounded-lg border border-[#e5e9ec] p-4">
              {finding.kind === "placeholder" ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-semibold text-black">Placeholder template</p>
                    <p className="mt-1 text-black/70">
                      {finding.template.label} — make “{finding.template.manufacturer}”, model “
                      {finding.template.model}”
                    </p>
                    <p className="mt-1 text-xs text-black/55">
                      {finding.template.assetCount === 0
                        ? "No assets use this template."
                        : `Used by ${plural(finding.template.assetCount, "asset")}. Edit the template to give it a real make and model.`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canResolve && finding.template.assetCount === 0 ? (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => setPending({ kind: "remove_placeholder", finding })}
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : null}
                    {keepBothButton(finding, "Keep")}
                  </div>
                </div>
              ) : finding.kind === "manufacturer" ? (
                <div>
                  <p className="text-sm font-semibold text-black">Manufacturer spelled differently</p>
                  <fieldset className="mt-2 space-y-1 text-sm">
                    <legend className="sr-only">Spelling to keep</legend>
                    {finding.spellings.map((s) => (
                      <label key={s.manufacturer} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={finding.key}
                          disabled={!canResolve}
                          checked={choiceFor(finding) === s.manufacturer}
                          onChange={() => setChoices((c) => ({ ...c, [finding.key]: s.manufacturer }))}
                          className="accent-brand"
                        />
                        <span className="font-medium text-black">{s.manufacturer}</span>
                        <span className="text-xs text-black/55">
                          {plural(s.templateCount, "template")}, {plural(s.assetCount, "asset")}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mergeButton(() =>
                      setPending({ kind: "merge_manufacturer", finding, canonical: choiceFor(finding) })
                    , "Merge spellings")}
                    {keepBothButton(finding)}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-black">Same device listed more than once</p>
                  <fieldset className="mt-2 space-y-1 text-sm">
                    <legend className="sr-only">Template to keep</legend>
                    {finding.templates.map((t) => (
                      <label key={t.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={finding.key}
                          disabled={!canResolve}
                          checked={choiceFor(finding) === t.id}
                          onChange={() => setChoices((c) => ({ ...c, [finding.key]: t.id }))}
                          className="accent-brand"
                        />
                        <span className="font-medium text-black">{t.label}</span>
                        <span className="text-xs text-black/55">
                          {t.manufacturer} {t.model} · {plural(t.assetCount, "asset")}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mergeButton(() =>
                      setPending({ kind: "merge_templates", finding, keepId: choiceFor(finding) })
                    )}
                    {keepBothButton(finding)}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!loading && !canResolve && findings.length > 0 ? (
        <p className="mt-3 text-xs text-black/55">Only an admin can merge or keep these.</p>
      ) : null}

      {pending?.kind === "remove_placeholder" ? (
        <ConfirmDeleteDialog
          open
          title="Remove placeholder template?"
          itemName={pending.finding.template.label}
          itemDetail={`${pending.finding.template.manufacturer} ${pending.finding.template.model}`}
          consequence="No assets use this template. It is removed from the catalog."
          busy={busyKey !== null}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmPending()}
        />
      ) : pending?.kind === "merge_templates" ? (
        <ConfirmDeleteDialog
          open
          destructive={false}
          confirmLabel="Merge"
          busyLabel="Merging…"
          title="Merge duplicate templates?"
          itemName={`Keep ${pending.finding.templates.find((t) => t.id === pending.keepId)?.label ?? ""}`}
          itemDetail={`Merge in: ${pending.finding.templates
            .filter((t) => t.id !== pending.keepId)
            .map((t) => `${t.label} (${plural(t.assetCount, "asset")})`)
            .join(", ")}`}
          consequence="Assets on the other templates move to the one you keep, then the other templates are removed. Asset make and model are not changed."
          busy={busyKey !== null}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmPending()}
        />
      ) : pending?.kind === "merge_manufacturer" ? (
        <ConfirmDeleteDialog
          open
          destructive={false}
          confirmLabel="Merge"
          busyLabel="Merging…"
          title="Use one manufacturer spelling?"
          itemName={`Keep “${pending.canonical}”`}
          itemDetail={`Rename: ${pending.finding.spellings
            .map((s) => s.manufacturer)
            .filter((m) => m !== pending.canonical)
            .join(", ")}`}
          consequence="Templates with the other spellings are renamed. If that would clash with an existing template, it is left alone so you can merge it separately. Asset records are not changed."
          busy={busyKey !== null}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmPending()}
        />
      ) : null}
    </section>
  );
}
