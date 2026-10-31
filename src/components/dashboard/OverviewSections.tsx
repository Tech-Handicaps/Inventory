"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { STAGE_DOT } from "@/components/board/types";
import { InfoTip } from "@/components/ui/InfoTip";
import type { CoverageStat, DashboardOverview } from "@/lib/reports/dashboard-overview-summary";

const nf = new Intl.NumberFormat("en-ZA");

export function KpiTile({
  label,
  value,
  hint,
  href,
  metricKey,
  onExplain,
}: {
  label: string;
  value: number;
  hint?: string;
  href: string;
  metricKey: string;
  onExplain: (metricKey: string, label: string) => void;
}) {
  return (
    <div className="kpi-card group relative p-4 transition hover:ring-2 hover:ring-brand/30">
      <Link
        href={href}
        className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={`${label}: ${value}. Open in All assets`}
      >
        <p className="pr-6 text-xs font-medium text-muted">{label}</p>
        <p className="mt-1 font-heading text-3xl font-bold tabular-nums text-ink">{nf.format(value)}</p>
        {hint ? <p className="mt-1 text-xs leading-snug text-muted">{hint}</p> : null}
      </Link>
      <button
        type="button"
        onClick={() => onExplain(metricKey, label)}
        className="absolute right-2 top-2 rounded p-1 text-muted hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={`Explain ${label}`}
        title="Explain this figure"
      >
        <MessageCircleQuestion className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function StageBar({ stages, total }: { stages: DashboardOverview["stages"]; total: number }) {
  const shown = stages.filter((s) => s.count > 0);
  return (
    <section className="section-card p-6" aria-labelledby="stage-bar-heading">
      <h2 id="stage-bar-heading" className="font-heading text-lg font-bold text-ink">
        Units by stage
      </h2>
      <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        {shown.map((s) => (
          <div
            key={s.code}
            className={`${STAGE_DOT[s.code] ?? "bg-muted"} h-full border-r border-white last:border-r-0`}
            style={{ width: `${(s.count / Math.max(total, 1)) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {stages.map((s) => (
          <li key={s.code}>
            <Link
              href={`/assets?status=${encodeURIComponent(s.code)}`}
              className="inline-flex items-center gap-2 rounded text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${STAGE_DOT[s.code] ?? "bg-muted"}`} aria-hidden />
              {s.label}
              <span className="font-semibold tabular-nums">{s.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const DONUT_COLOURS = ["#3c854a", "#20282d", "#7fbf8a", "#5b6670", "#b5dbbc", "#9aa4ac", "#2c6237", "#cdd3d8"];
const UNKNOWN_COLOUR = "#eef1f3";
const MAX_SLICES = 9;

type Slice = { name: string; count: number; colour: string };

function donutSlices(manufacturers: DashboardOverview["manufacturers"]): Slice[] {
  const known = manufacturers.filter((m) => m.name !== "Unknown");
  const unknown = manufacturers.find((m) => m.name === "Unknown");
  const keep = known.length > MAX_SLICES - 1 ? known.slice(0, MAX_SLICES - 2) : known;
  const rest = known.slice(keep.length).reduce((sum, m) => sum + m.count, 0);
  const slices: Slice[] = keep.map((m, i) => ({ ...m, colour: DONUT_COLOURS[i % DONUT_COLOURS.length] }));
  if (rest) slices.push({ name: "Other", count: rest, colour: DONUT_COLOURS[slices.length % DONUT_COLOURS.length] });
  if (unknown) slices.push({ ...unknown, colour: UNKNOWN_COLOUR });
  return slices;
}

/** SVG donut with each slice labelled beside it; labels are spread so small slices stay readable. */
export function ManufacturerDonut({ manufacturers, total }: { manufacturers: DashboardOverview["manufacturers"]; total: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const slices = donutSlices(manufacturers);
  const W = 440;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const R = 92;
  const r = 58;
  const LINE = 16;

  const sweeps = slices.map((s) => (s.count / Math.max(total, 1)) * Math.PI * 2);
  const arcs = slices.map((s, i) => {
    const start = -Math.PI / 2 + sweeps.slice(0, i).reduce((sum, x) => sum + x, 0);
    return { ...s, start, end: start + sweeps[i], mid: start + sweeps[i] / 2 };
  });

  const labels = arcs.map((a) => ({
    ...a,
    right: Math.cos(a.mid) >= 0,
    y: cy + (R + 16) * Math.sin(a.mid),
  }));
  for (const right of [true, false]) {
    const side = labels.filter((l) => l.right === right).sort((x, y) => x.y - y.y);
    for (let i = 1; i < side.length; i++) side[i].y = Math.max(side[i].y, side[i - 1].y + LINE);
    const overflow = side.length ? side[side.length - 1].y - (H - 8) : 0;
    if (overflow > 0) for (const l of side) l.y -= overflow;
    for (let i = side.length - 2; i >= 0; i--) side[i].y = Math.min(side[i].y, side[i + 1].y - LINE);
  }

  const point = (rad: number, a: number) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)] as const;
  const path = (a: (typeof arcs)[number]) => {
    if (a.end - a.start >= Math.PI * 2 - 1e-6) {
      return `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} L ${cx - 0.01} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`;
    }
    const large = a.end - a.start > Math.PI ? 1 : 0;
    const [x1, y1] = point(R, a.start);
    const [x2, y2] = point(R, a.end);
    const [x3, y3] = point(r, a.end);
    const [x4, y4] = point(r, a.start);
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
  };

  const summary = slices.map((s) => `${s.name} ${s.count}`).join(", ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-[440px]" role="img" aria-label={`Units by manufacturer: ${summary}. Total ${total}.`}>
        {arcs.map((a) => (
          <path
            key={a.name}
            d={path(a)}
            fill={a.colour}
            stroke="#fff"
            strokeWidth={1.5}
            opacity={hover && hover !== a.name ? 0.45 : 1}
            onMouseEnter={() => setHover(a.name)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${a.name}: ${a.count} (${Math.round((a.count / Math.max(total, 1)) * 100)}%)`}</title>
          </path>
        ))}
        {labels.map((l) => {
          const [ex, ey] = point(R + 2, l.mid);
          const [bx, by] = point(R + 10, l.mid);
          const tx = l.right ? cx + R + 30 : cx - R - 30;
          return (
            <g key={l.name} opacity={hover && hover !== l.name ? 0.45 : 1}>
              <polyline points={`${ex},${ey} ${bx},${by} ${tx + (l.right ? -4 : 4)},${l.y}`} fill="none" stroke="#9aa4ac" strokeWidth={1} />
              <text
                x={tx}
                y={l.y}
                dominantBaseline="middle"
                textAnchor={l.right ? "start" : "end"}
                className="fill-ink text-[12px]"
              >
                {l.name} <tspan className="font-semibold">{l.count}</tspan>
              </text>
            </g>
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-ink font-heading text-[22px] font-bold">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted text-[11px]">
          units
        </text>
      </svg>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

export function TopModels({ skus, distinctModels }: { skus: DashboardOverview["topSkus"]; distinctModels: number }) {
  const max = Math.max(1, ...skus.map((s) => s.count));
  if (!skus.length) return <p className="text-sm text-muted">No models recorded yet.</p>;
  return (
    <>
      <ol className="space-y-2.5">
        {skus.map((s) => (
          <li key={`${s.brand}-${s.model}`}>
            <Link
              href={`/assets?q=${encodeURIComponent(s.model)}`}
              className="group block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink group-hover:underline" title={`${s.brand} ${s.model}`}>
                  {s.model.toLowerCase().startsWith(s.brand.toLowerCase()) ? null : (
                    <span className="text-muted">{s.brand} </span>
                  )}
                  {s.model}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{s.count}</span>
              </span>
              <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full rounded-full bg-hna-green-strong" style={{ width: `${(s.count / max) * 100}%` }} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">{distinctModels} different models in total. Click a model to see its units.</p>
    </>
  );
}

function sentence(have: number, of: number, label: string, key: string) {
  const units = key === "club" ? "" : " units";
  if (have === 0 && of > 0) return `None of ${of}${units} ${label}`;
  const prefix = of > 0 && have / of < 0.5 ? "Only " : "";
  return `${prefix}${have} of ${of}${units} ${label}`;
}

export function DataQualityCard({ items }: { items: DashboardOverview["dataQuality"] }) {
  return (
    <section className="section-card min-w-0 p-6" aria-labelledby="data-quality-heading">
      <h2 id="data-quality-heading" className="font-heading text-lg font-bold text-ink">
        Data quality
      </h2>
      <p className="mt-1 text-sm text-muted">Gaps here limit the age and warranty figures.</p>
      <ul className="mt-4 space-y-3">
        {items.map((d) => {
          const pct = d.of ? d.have / d.of : 1;
          return (
            <li key={d.key}>
              <p className={`text-sm ${pct < 0.5 ? "font-medium text-ink" : "text-muted"}`}>{sentence(d.have, d.of, d.label, d.key)}</p>
              <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
                <span
                  className={`block h-full rounded-full ${pct < 0.5 ? "bg-amber-500" : "bg-hna-green-strong"}`}
                  style={{ width: `${pct * 100}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled
        className="btn-secondary mt-5 cursor-not-allowed opacity-60"
        title="The bulk-edit tool arrives in Phase 6"
      >
        Fix in bulk (coming soon)
      </button>
    </section>
  );
}

/** A figure that needs per-unit data; muted and labelled when under half the units have it. */
export function CoverageFigure({
  label,
  stat,
  format,
  help,
}: {
  label: string;
  stat: CoverageStat;
  format: (value: number) => string;
  help?: string;
}) {
  const value = stat.value == null ? "—" : format(stat.value);
  return (
    <div className={`kpi-card p-4 ${stat.lowCoverage ? "bg-black/[0.02]" : ""}`}>
      <p className="flex items-center gap-1 text-xs font-medium text-muted">
        {label}
        {help ? <InfoTip label={`About ${label}`}>{help}</InfoTip> : null}
      </p>
      <p className={`mt-1 font-heading text-2xl font-bold tabular-nums ${stat.lowCoverage ? "text-muted" : "text-ink"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">
        {stat.lowCoverage ? `Based on ${stat.basedOn} of ${stat.of} units` : `${stat.basedOn} of ${stat.of} units`}
      </p>
    </div>
  );
}
