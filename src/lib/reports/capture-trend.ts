/**
 * Field capture by month (spec 5.10): the hardware Deployed at each month end (SAST), replayed per asset from the
 * audit log, which starts with the first asset (18 April 2026), then matched to the export like the headline.
 * Today's register is the check on the replay.
 */

export type TrendAsset = { id: string; statusCode: string; dateAdded: Date; hardware: boolean };

export type StatusEvent = {
  assetId: string;
  at: Date;
  /**
   * `created`: the asset first appears with status `to`. `change`: status moved to `to` (`from` when logged).
   * `cancel`: an assessment was cancelled, so the asset is back where it was before the assessment.
   */
  kind: "created" | "change" | "cancel";
  from?: string;
  to?: string;
};

const OUTCOME_STATUS: Record<string, string> = {
  written_off: "written_off",
  refurbished: "refurbished",
  returned_to_club: "deployed",
};

export type AuditRow = { actionType: string; timestamp: Date; metadata: unknown };

export type CaptureTrendPoint = {
  monthKey: string;
  deployed: number;
  /** HNA-owned export terminals matched by the units Deployed at that month end (same rule as the headline). */
  captured: number;
  /** `captured` as a % of the HNA-owned terminals in the field export. */
  pct: number;
  /** The current month, counted up to now. */
  toDate: boolean;
};

export type CaptureTrend = {
  points: CaptureTrendPoint[];
  /** Assets whose logged history does not lead back to their recorded starting status. */
  unreconciled: number;
};

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Status events recorded in the audit log. Rows without an asset id or status information are ignored. */
export function statusEventsFromAudit(rows: AuditRow[]): StatusEvent[] {
  const out: StatusEvent[] = [];
  for (const row of rows) {
    const meta = rec(row.metadata);
    const assetId = str(meta?.assetId);
    if (!meta || !assetId) continue;
    const change = rec(rec(meta.changes)?.statusCode);
    if (change) {
      out.push({ assetId, at: row.timestamp, kind: "change", from: str(change.from), to: str(change.to) });
    } else if (row.actionType === "asset.write_off" && str(meta.fromStatusCode)) {
      out.push({ assetId, at: row.timestamp, kind: "change", from: str(meta.fromStatusCode), to: "written_off" });
    } else if (row.actionType === "asset.imported_from_zoho_assist") {
      out.push(
        str(meta.redeployedFromStatus)
          ? { assetId, at: row.timestamp, kind: "change", from: str(meta.redeployedFromStatus), to: "deployed" }
          : { assetId, at: row.timestamp, kind: "created", to: "deployed" }
      );
    } else if (row.actionType === "asset.created") {
      out.push({ assetId, at: row.timestamp, kind: "created", to: str(meta.statusCode) });
    } else if (row.actionType === "asset.write_off") {
      out.push({ assetId, at: row.timestamp, kind: "change", to: "written_off" });
    } else if (row.actionType === "asset.redeployed_from_zoho_assist") {
      out.push({ assetId, at: row.timestamp, kind: "change", to: "deployed" });
    } else if (row.actionType === "assessment.created") {
      out.push({ assetId, at: row.timestamp, kind: "change", to: "assessment" });
    } else if (row.actionType === "assessment.cancelled") {
      out.push({ assetId, at: row.timestamp, kind: "cancel" });
    } else if (row.actionType === "assessment.completed" && OUTCOME_STATUS[str(meta.outcome) ?? ""]) {
      out.push({ assetId, at: row.timestamp, kind: "change", to: OUTCOME_STATUS[str(meta.outcome)!] });
    }
  }
  return out;
}

/** Last instant of each month in SAST (UTC+2, no daylight saving), from `fromKey` to the month of `now`. */
export function monthEnds(fromKey: string, now: Date): { monthKey: string; end: Date }[] {
  const out: { monthKey: string; end: Date }[] = [];
  let [y, m] = fromKey.split("-").map(Number);
  const sast = new Date(now.getTime() + 2 * 3600_000);
  const lastKey = `${sast.getUTCFullYear()}-${String(sast.getUTCMonth() + 1).padStart(2, "0")}`;
  for (;;) {
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    const end = new Date(Date.UTC(y, m, 1) - 2 * 3600_000 - 1);
    out.push({ monthKey, end: monthKey === lastKey ? now : end });
    if (monthKey === lastKey || out.length > 120) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * Status at `at`, or null when the asset did not exist yet. `events` are this asset's, oldest first. Without a
 * creation event the asset is taken to exist from `dateAdded`, starting where its first logged change began.
 */
function statusAt(asset: TrendAsset, events: StatusEvent[], at: Date): string | null {
  const created = events.find((e) => e.kind === "created");
  if (created ? created.at > at : asset.dateAdded > at) return null;
  let status: string | null = created?.to ?? events.find((e) => e.from)?.from ?? asset.statusCode;
  let beforeAssessment: string | null = status;
  for (const e of events) {
    if (e.at > at) break;
    if (e.kind === "cancel") status = beforeAssessment;
    else if (e.to) {
      if (e.to === "assessment" && status !== "assessment") beforeAssessment = status;
      status = e.to;
    }
  }
  return status;
}

export function buildCaptureTrend(
  assets: TrendAsset[],
  events: StatusEvent[],
  opts: {
    fromMonthKey: string;
    now: Date;
    hnaOwned: number;
    /** Captured terminals for a set of Deployed asset ids; without it, Deployed capped at HNA-owned is used. */
    capturedOf?: (deployedIds: Set<string>) => number;
  }
): CaptureTrend {
  const byAsset = new Map<string, StatusEvent[]>();
  for (const e of events) byAsset.set(e.assetId, [...(byAsset.get(e.assetId) ?? []), e]);
  for (const list of byAsset.values()) list.sort((a, b) => a.at.getTime() - b.at.getTime());

  const hardware = assets.filter((a) => a.hardware);
  const far = new Date(8.64e15);
  const unreconciled = hardware.filter((a) => statusAt(a, byAsset.get(a.id) ?? [], far) !== a.statusCode).length;

  const months = monthEnds(opts.fromMonthKey, opts.now);
  const points = months.map(({ monthKey, end }, i) => {
    const ids = new Set(hardware.filter((a) => statusAt(a, byAsset.get(a.id) ?? [], end) === "deployed").map((a) => a.id));
    const captured = opts.capturedOf ? opts.capturedOf(ids) : Math.min(ids.size, opts.hnaOwned);
    return {
      monthKey,
      deployed: ids.size,
      captured,
      pct: opts.hnaOwned ? Math.round((captured / opts.hnaOwned) * 1000) / 10 : 0,
      toDate: i === months.length - 1,
    };
  });
  return { points, unreconciled };
}
