import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveAssetSkuModelLabel } from "@/lib/inventory/device-template-label";

const TIMELINE_LIMIT = 80;

export type ClubMovementUnit = {
  assetName: string;
  status: string;
  statusCode: string;
  model: string;
  serialNumber: string;
  category: string;
  lastUpdated: string;
  writeOffReference?: string;
  writeOffReason?: string;
  replacementRequested?: boolean;
  replacementAssetName?: string;
  replacementMakeModel?: string;
  replacementSerialNumber?: string;
};

export type ClubReplacementPair = {
  retiredAssetName: string;
  retiredModel: string;
  retiredSerial: string;
  writeOffReference: string;
  replacementAssetName: string;
  replacementModel: string;
  replacementSerial: string;
};

/** Chronological lifecycle event at this club (audit + dispatch + write-off). */
export type ClubMovementEvent = {
  id: string;
  at: string;
  assetName: string;
  actionType: string;
  summary: string;
};

export type ClubMovementSnapshot = {
  clubId: string;
  clubName: string;
  active: ClubMovementUnit[];
  retired: ClubMovementUnit[];
  replacementPairs: ClubReplacementPair[];
  /** Oldest → newest site movement history across related assets. */
  timeline: ClubMovementEvent[];
  timelineTotal: number;
  generatedAt: string;
};

const CLUB_QUERY_WORDS =
  /\b(golf\s+club|club|movement|hardware|assigned|deployed|retired|written\s+off|replacement|terminal|site)\b/i;

const COMMON_CLUB_WORDS = new Set([
  "golf",
  "club",
  "country",
  "cc",
  "the",
  "and",
  "of",
]);

function scoreClubNameInMessage(message: string, clubName: string): number {
  const m = message.toLowerCase();
  const nameLower = clubName.toLowerCase();
  if (m.includes(nameLower)) return 100;

  const words = nameLower.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return 0;

  const distinctive = words.filter((w) => !COMMON_CLUB_WORDS.has(w));
  const common = words.filter((w) => COMMON_CLUB_WORDS.has(w));

  const matchedDistinctive = distinctive.filter((w) => m.includes(w));
  const matchedCommon = common.filter((w) => m.includes(w));

  // Distinctive tokens (e.g. "akasia") matter far more than "golf" / "club"
  if (distinctive.length > 0 && matchedDistinctive.length === distinctive.length) {
    return 90 + matchedCommon.length;
  }
  if (matchedDistinctive.length > 0) {
    return 60 + matchedDistinctive.length * 15 + matchedCommon.length * 2;
  }

  const matched = words.filter((w) => m.includes(w));
  if (matched.length === words.length) return 85;
  if (matched.length >= 2) return 40; // weak — only common words
  return 0;
}

export async function resolveClubFromMessage(
  message: string
): Promise<{ id: string; name: string } | null> {
  const clubs = await prisma.club.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let best: { id: string; name: string; score: number } | null = null;
  for (const club of clubs) {
    const score = scoreClubNameInMessage(message, club.name);
    if (score > (best?.score ?? 0)) {
      best = { ...club, score };
    }
  }

  if (!best || best.score < 60) return null;

  const ties = clubs.filter(
    (c) => scoreClubNameInMessage(message, c.name) === best!.score
  );
  if (ties.length > 1) {
    const exact = ties.find((c) =>
      message.toLowerCase().includes(c.name.toLowerCase())
    );
    if (exact) return exact;
    // Prefer the club whose distinctive name token appears in the message
    const withDistinctive = ties.find((c) => {
      const distinctive = c.name
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !COMMON_CLUB_WORDS.has(w));
      return distinctive.some((w) => message.toLowerCase().includes(w));
    });
    return withDistinctive ?? null;
  }

  return { id: best.id, name: best.name };
}

export function wantsClubMovement(
  message: string,
  resolvedClub?: { name: string } | null
): boolean {
  const m = message.toLowerCase();

  if (!CLUB_QUERY_WORDS.test(message) && !resolvedClub) return false;

  if (
    m.includes("movement") ||
    m.includes("hardware at") ||
    m.includes("assets at") ||
    m.includes("asset movement") ||
    m.includes("assigned to") ||
    m.includes("deployed at") ||
    m.includes("terminal at") ||
    m.includes("terminals at") ||
    (m.includes("search") &&
      (m.includes("club") || m.includes("terminal"))) ||
    m.includes("golf club") ||
    (m.includes("club") &&
      (m.includes("asset") ||
        m.includes("terminal") ||
        m.includes("movement") ||
        m.includes("written") ||
        m.includes("replacement") ||
        m.includes("for ")))
  ) {
    return true;
  }

  return Boolean(resolvedClub && CLUB_QUERY_WORDS.test(message));
}

function mapAssetToUnit(
  a: {
    assetName: string;
    category: string;
    serialNumber: string | null;
    manufacturer: string | null;
    model: string | null;
    dateUpdated: Date;
    reason: string | null;
    status: { code: string; label: string };
    deviceTemplate?: { manufacturer: string; model: string } | null;
  },
  cert?: {
    referenceNumber: string;
    replacementRequested: boolean;
    replacementAssetName: string | null;
    replacementMakeModel: string | null;
    replacementSerialNumber: string | null;
  } | null
): ClubMovementUnit {
  return {
    assetName: a.assetName,
    status: a.status.label,
    statusCode: a.status.code,
    model: resolveAssetSkuModelLabel(a),
    serialNumber: a.serialNumber ?? "",
    category: a.category,
    lastUpdated: a.dateUpdated.toISOString().slice(0, 10),
    ...(cert
      ? {
          writeOffReference: cert.referenceNumber,
          writeOffReason: a.reason ?? undefined,
          replacementRequested: cert.replacementRequested,
          replacementAssetName: cert.replacementAssetName ?? undefined,
          replacementMakeModel: cert.replacementMakeModel ?? undefined,
          replacementSerialNumber: cert.replacementSerialNumber ?? undefined,
        }
      : {}),
  };
}

function findReplacementInActive(
  active: ClubMovementUnit[],
  cert: {
    replacementAssetName: string | null;
    replacementSerialNumber: string | null;
  }
): ClubMovementUnit | undefined {
  const serial = cert.replacementSerialNumber?.trim().toLowerCase();
  if (serial) {
    const bySerial = active.find(
      (u) => u.serialNumber.trim().toLowerCase() === serial
    );
    if (bySerial) return bySerial;
  }

  const name = cert.replacementAssetName?.trim().toLowerCase();
  if (name) {
    const byName = active.find(
      (u) => u.assetName.trim().toLowerCase() === name
    );
    if (byName) return byName;
  }

  return undefined;
}

function formatAuditSummary(
  actionType: string,
  notes: string | null,
  metadata: unknown
): string {
  const meta =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : null;

  if (actionType === "asset.created") {
    const code = meta?.statusCode;
    return `Added to inventory${typeof code === "string" ? ` (${code})` : ""}`;
  }

  if (actionType === "asset.write_off") {
    const cert =
      typeof meta?.writeOffCertificate === "string"
        ? meta.writeOffCertificate
        : null;
    const replacement = meta?.replacementRequested === true;
    const replacementName =
      typeof meta?.replacementAssetName === "string"
        ? meta.replacementAssetName
        : null;
    let summary = cert ? `Written off (${cert})` : "Written off";
    if (replacement) {
      summary += replacementName
        ? ` — replacement: ${replacementName}`
        : " — replacement requested";
    }
    const reason =
      typeof meta?.writeOffReason === "string" ? meta.writeOffReason : null;
    if (reason) summary += ` · ${reason}`;
    return summary;
  }

  if (actionType === "dispatch.created") {
    return notes?.trim() || "Dispatched to field";
  }

  if (actionType === "asset.refurbished") {
    const fromClub =
      typeof meta?.fromClubName === "string" ? meta.fromClubName : null;
    return fromClub
      ? `Refurbished — cleared from ${fromClub}`
      : notes?.trim() || "Moved to refurbished";
  }

  if (actionType === "repair.created") {
    const st = meta?.repairStatus;
    return `Repair logged${typeof st === "string" ? ` (${st})` : ""}`;
  }

  if (actionType === "assessment.created") {
    const ref = meta?.referenceNumber;
    return `Assessment opened${typeof ref === "string" ? ` (${ref})` : ""}`;
  }

  if (actionType === "assessment.completed") {
    const ref = meta?.referenceNumber;
    const outcome = meta?.outcome;
    let s = `Assessment completed${typeof ref === "string" ? ` (${ref})` : ""}`;
    if (typeof outcome === "string") s += ` → ${outcome.replace(/_/g, " ")}`;
    return s;
  }

  if (actionType === "asset.updated" && meta) {
    const changes = meta.changes as Record<string, unknown> | undefined;
    const statusCh = changes?.statusCode as
      | { from?: string; to?: string }
      | undefined;
    if (statusCh?.from != null && statusCh?.to != null) {
      return `Lifecycle: ${String(statusCh.from)} → ${String(statusCh.to)}`;
    }
    const clubCh = changes?.clubId as
      | { from?: string | null; to?: string | null }
      | undefined;
    if (clubCh && clubCh.from !== clubCh.to) {
      if (!clubCh.from && clubCh.to) return "Assigned to club";
      if (clubCh.from && !clubCh.to) return "Removed from club";
      return "Club assignment changed";
    }
    if (changes && Object.keys(changes).length > 0) {
      return `Updated (${Object.keys(changes).join(", ")})`;
    }
  }

  return notes?.trim() || actionType;
}

async function collectRelatedAssetIds(
  clubId: string,
  clubName: string
): Promise<{
  currentIds: string[];
  allIds: string[];
  nameById: Map<string, string>;
}> {
  const [currentAssets, vouchers, certs] = await Promise.all([
    prisma.asset.findMany({
      where: { clubId },
      select: { id: true, assetName: true },
    }),
    prisma.dispatchVoucher.findMany({
      where: { clubName: { equals: clubName, mode: "insensitive" } },
      select: { assetId: true, asset: { select: { assetName: true } } },
    }),
    prisma.writeOffCertificate.findMany({
      where: { clubName: { equals: clubName, mode: "insensitive" } },
      select: { assetId: true, assetName: true },
    }),
  ]);

  const nameById = new Map<string, string>();
  const currentIds: string[] = [];
  for (const a of currentAssets) {
    currentIds.push(a.id);
    nameById.set(a.id, a.assetName);
  }
  for (const v of vouchers) {
    nameById.set(v.assetId, v.asset.assetName);
  }
  for (const c of certs) {
    nameById.set(c.assetId, c.assetName);
  }

  const allIds = [...new Set([...currentIds, ...nameById.keys()])];
  return { currentIds, allIds, nameById };
}

async function buildClubTimeline(
  clubName: string,
  assetIds: string[],
  nameById: Map<string, string>
): Promise<{ events: ClubMovementEvent[]; total: number }> {
  if (assetIds.length === 0) {
    return { events: [], total: 0 };
  }

  const auditWhere: Prisma.AuditLogWhereInput = {
    OR: assetIds.map((id) => ({
      metadata: { path: ["assetId"], equals: id },
    })),
  };

  const [auditLogs, dispatches, writeOffs] = await Promise.all([
    prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { timestamp: "asc" },
      take: 500,
    }),
    prisma.dispatchVoucher.findMany({
      where: {
        OR: [
          { assetId: { in: assetIds } },
          { clubName: { equals: clubName, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        assetId: true,
        referenceNumber: true,
        fromStatusCode: true,
        dispatchedAt: true,
        asset: { select: { assetName: true } },
      },
      orderBy: { dispatchedAt: "asc" },
    }),
    prisma.writeOffCertificate.findMany({
      where: {
        OR: [
          { assetId: { in: assetIds } },
          { clubName: { equals: clubName, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        assetId: true,
        referenceNumber: true,
        assetName: true,
        writtenOffAt: true,
        replacementRequested: true,
        replacementAssetName: true,
        reason: true,
      },
      orderBy: { writtenOffAt: "asc" },
    }),
  ]);

  const events: ClubMovementEvent[] = [];
  const seenKeys = new Set<string>();

  for (const row of auditLogs) {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const assetId = typeof meta?.assetId === "string" ? meta.assetId : null;
    const assetName =
      (assetId && nameById.get(assetId)) ||
      (row.notes?.match(/^[^:]+:\s*(.+?)(?:\s*—|$)/)?.[1]?.trim() ??
        "Unknown asset");
    const summary = formatAuditSummary(row.actionType, row.notes, row.metadata);
    const key = `audit:${row.id}`;
    seenKeys.add(key);
    events.push({
      id: key,
      at: row.timestamp.toISOString(),
      assetName,
      actionType: row.actionType,
      summary,
    });
  }

  for (const d of dispatches) {
    const key = `dispatch:${d.id}`;
    if (seenKeys.has(key)) continue;
    // Prefer audit when a matching dispatch.created exists around the same time
    const nearAudit = events.some(
      (e) =>
        e.actionType === "dispatch.created" &&
        e.assetName === d.asset.assetName &&
        Math.abs(new Date(e.at).getTime() - d.dispatchedAt.getTime()) < 60_000
    );
    if (nearAudit) continue;
    events.push({
      id: key,
      at: d.dispatchedAt.toISOString(),
      assetName: d.asset.assetName,
      actionType: "dispatch.created",
      summary: `Dispatched (${d.referenceNumber}) · from ${d.fromStatusCode}`,
    });
  }

  for (const w of writeOffs) {
    const key = `writeoff:${w.id}`;
    const nearAudit = events.some(
      (e) =>
        e.actionType === "asset.write_off" &&
        e.assetName === w.assetName &&
        Math.abs(new Date(e.at).getTime() - w.writtenOffAt.getTime()) < 60_000
    );
    if (nearAudit) continue;
    let summary = `Written off (${w.referenceNumber})`;
    if (w.replacementRequested) {
      summary += w.replacementAssetName
        ? ` — replacement: ${w.replacementAssetName}`
        : " — replacement requested";
    }
    if (w.reason) summary += ` · ${w.reason}`;
    events.push({
      id: key,
      at: w.writtenOffAt.toISOString(),
      assetName: w.assetName,
      actionType: "asset.write_off",
      summary,
    });
  }

  events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  const total = events.length;
  const trimmed =
    total > TIMELINE_LIMIT ? events.slice(total - TIMELINE_LIMIT) : events;

  return { events: trimmed, total };
}

export async function buildClubMovementSnapshot(
  clubId: string,
  clubName: string
): Promise<ClubMovementSnapshot> {
  const { allIds, nameById } = await collectRelatedAssetIds(clubId, clubName);

  const assets = await prisma.asset.findMany({
    where: { clubId },
    include: { status: true, deviceTemplate: true },
    orderBy: { assetName: "asc" },
  });

  const writtenOffIds = assets
    .filter((a) => a.status.code === "written_off")
    .map((a) => a.id);

  const certByAssetId = new Map<
    string,
    {
      referenceNumber: string;
      replacementRequested: boolean;
      replacementAssetName: string | null;
      replacementMakeModel: string | null;
      replacementSerialNumber: string | null;
    }
  >();

  if (writtenOffIds.length > 0) {
    const certs = await prisma.writeOffCertificate.findMany({
      where: { assetId: { in: writtenOffIds } },
      select: {
        assetId: true,
        referenceNumber: true,
        replacementRequested: true,
        replacementAssetName: true,
        replacementMakeModel: true,
        replacementSerialNumber: true,
      },
      orderBy: { createdAt: "desc" },
    });
    for (const c of certs) {
      if (!certByAssetId.has(c.assetId)) {
        certByAssetId.set(c.assetId, c);
      }
    }
  }

  const active: ClubMovementUnit[] = [];
  const retired: ClubMovementUnit[] = [];

  for (const a of assets) {
    const cert = certByAssetId.get(a.id) ?? null;
    const unit = mapAssetToUnit(a, cert);
    if (a.status.code === "written_off") {
      retired.push(unit);
    } else {
      active.push(unit);
    }
  }

  const replacementPairs: ClubReplacementPair[] = [];
  for (const r of retired) {
    if (!r.replacementRequested || !r.writeOffReference) continue;
    const match = findReplacementInActive(active, {
      replacementAssetName: r.replacementAssetName ?? null,
      replacementSerialNumber: r.replacementSerialNumber ?? null,
    });
    if (!match) continue;
    replacementPairs.push({
      retiredAssetName: r.assetName,
      retiredModel: r.model,
      retiredSerial: r.serialNumber,
      writeOffReference: r.writeOffReference,
      replacementAssetName: match.assetName,
      replacementModel: match.model,
      replacementSerial: match.serialNumber,
    });
  }

  const { events: timeline, total: timelineTotal } = await buildClubTimeline(
    clubName,
    allIds,
    nameById
  );

  return {
    clubId,
    clubName,
    active,
    retired,
    replacementPairs,
    timeline,
    timelineTotal,
    generatedAt: new Date().toISOString(),
  };
}

export async function listClubNames(): Promise<string[]> {
  const clubs = await prisma.club.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return clubs.map((c) => c.name);
}

/** Deterministic reply when club movement was requested but no club matched. */
export function clubNotFoundReply(
  displayName: string | undefined,
  clubNames: string[]
): string {
  const who = displayName?.trim() || "there";
  const sample =
    clubNames.length > 0
      ? `\n\nKnown clubs include: ${clubNames.slice(0, 8).join(", ")}${clubNames.length > 8 ? "…" : ""}.`
      : "";
  return `Hi ${who}! I couldn't match a golf club from your message. Try asking again with the full club name — for example: "asset movement for Akasia Golf Club".${sample}`;
}

/** Always-accurate club movement answer from live snapshot (do not trust the LLM for counts). */
export function buildClubMovementReply(
  snapshot: ClubMovementSnapshot,
  displayName?: string
): string {
  const who = displayName?.trim() || "there";
  const { clubName, active, retired, replacementPairs, timeline, timelineTotal } =
    snapshot;

  if (active.length === 0 && retired.length === 0) {
    return `Hi ${who}! I matched **${clubName}**, but no hardware is currently linked to that club in inventory (no active or written-off units with this club assignment). If you expected a terminal there, check All assets — the unit may still need a club assignment.`;
  }

  const lines: string[] = [
    `Hi ${who}! Here's the asset movement for **${clubName}**:`,
    "",
    `**Currently assigned (${active.length})**`,
  ];

  if (active.length === 0) {
    lines.push("• None right now.");
  } else {
    for (const u of active) {
      const serial = u.serialNumber ? ` · S/N ${u.serialNumber}` : "";
      lines.push(
        `• ${u.assetName} — ${u.status} · ${u.model || "model n/a"}${serial}`
      );
    }
  }

  lines.push("", `**Written off / retired (${retired.length})**`);
  if (retired.length === 0) {
    lines.push("• None on record for this club.");
  } else {
    for (const u of retired) {
      const serial = u.serialNumber ? ` · S/N ${u.serialNumber}` : "";
      const ref = u.writeOffReference ? ` · ${u.writeOffReference}` : "";
      lines.push(
        `• ${u.assetName} — ${u.status} · ${u.model || "model n/a"}${serial}${ref}`
      );
    }
  }

  if (replacementPairs.length > 0) {
    lines.push("", "**Replacement pairs**");
    for (const p of replacementPairs) {
      lines.push(
        `• ${p.retiredAssetName} → ${p.replacementAssetName} (${p.writeOffReference})`
      );
    }
  }

  if (timeline.length > 0) {
    const recent = timeline.slice(-5);
    lines.push(
      "",
      `**Recent movement** (${timelineTotal} event${timelineTotal === 1 ? "" : "s"} total)`
    );
    for (const e of recent) {
      const day = e.at.slice(0, 10);
      lines.push(`• ${day} — ${e.assetName}: ${e.summary}`);
    }
  }

  lines.push(
    "",
    "See the tables and timeline below — use **Download CSV** to export."
  );
  return lines.join("\n");
}

export function sanitizeClubMovementReply(
  reply: string,
  snapshot: ClubMovementSnapshot,
  displayName?: string
): string {
  const hasUnits = snapshot.active.length + snapshot.retired.length > 0;
  const claimsEmpty =
    /no hardware|no assets|nothing (is |was )?linked|not associated|no units|no terminals|couldn't find any|could not find any|no equipment|no devices|doesn't have any|does not have any|aren't any|are no /i.test(
      reply
    );

  // Never let the model invent an empty club when we have live units
  if (hasUnits && claimsEmpty) {
    return buildClubMovementReply(snapshot, displayName);
  }

  const denies =
    /can't|cannot|don't have|look for an export|reports section|system admin/i.test(
      reply
    );

  if (denies) {
    return buildClubMovementReply(snapshot, displayName);
  }

  if (!/download csv|tables below|timeline|below/i.test(reply)) {
    return `${reply}\n\nUse the tables and timeline below (and **Download CSV**) for the full ${snapshot.clubName} movement history.`;
  }

  return reply;
}
