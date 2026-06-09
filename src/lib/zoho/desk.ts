import { prisma } from "@/lib/prisma";
import {
  maskZohoSecrets,
  refreshZohoAccessToken,
  type ZohoOAuthCredentials,
} from "@/lib/zoho/client";
import { type ZohoDataCenter } from "@/lib/zoho/constants";

/**
 * Scopes for Desk: tickets + listing departments (org setup & tests use GET /departments).
 * `Desk.search.READ` is required to resolve a display ticket number (e.g. "1292") to its
 * internal id — GET /tickets/{id} only accepts the long id, not the ticket number.
 */
export const ZOHO_DESK_OAUTH_SCOPES =
  "Desk.tickets.ALL,Desk.basic.READ,Desk.search.READ";

/** Desk API hosts (v1) — align with Zoho data center docs. */
const DESK_API_V1: Record<ZohoDataCenter, string> = {
  us: "https://desk.zoho.com/api/v1",
  eu: "https://desk.zoho.eu/api/v1",
  in: "https://desk.zoho.in/api/v1",
  au: "https://desk.zoho.com.au/api/v1",
  ca: "https://desk.zoho.com/api/v1",
  jp: "https://desk.zoho.jp/api/v1",
  sa: "https://desk.zoho.sa/api/v1",
};

export function getDeskApiV1Base(dataCenter: string): string {
  const dc = (dataCenter in DESK_API_V1
    ? dataCenter
    : "us") as ZohoDataCenter;
  return DESK_API_V1[dc] ?? DESK_API_V1.us;
}

export type ZohoDeskCredentials = ZohoOAuthCredentials & {
  orgId: string | null;
  departmentId: string | null;
};

export async function loadZohoDeskSettings(): Promise<ZohoDeskCredentials> {
  const row = await prisma.zohoDeskSettings.findUnique({
    where: { id: "singleton" },
  });
  return {
    orgId: row?.orgId ?? process.env.ZOHO_DESK_ORG_ID ?? null,
    departmentId:
      row?.departmentId ?? process.env.ZOHO_DESK_DEPARTMENT_ID ?? null,
    clientId: row?.clientId ?? process.env.ZOHO_DESK_CLIENT_ID ?? null,
    clientSecret: row?.clientSecret ?? process.env.ZOHO_DESK_CLIENT_SECRET ?? null,
    refreshToken: row?.refreshToken ?? process.env.ZOHO_DESK_REFRESH_TOKEN ?? null,
    dataCenter: row?.dataCenter ?? process.env.ZOHO_DESK_DATA_CENTER ?? "us",
  };
}

export function maskZohoDeskSecrets(c: ZohoDeskCredentials) {
  const base = maskZohoSecrets(c);
  return {
    ...base,
    orgId: c.orgId,
    departmentId: c.departmentId,
    configured:
      base.configured &&
      !!(c.orgId && c.orgId.length > 0),
  };
}

async function deskFetch(
  accessToken: string,
  orgId: string,
  dataCenter: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getDeskApiV1Base(dataCenter);
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      orgId,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

/**
 * Resolve department id: use settings, otherwise first active department.
 */
export async function resolveDepartmentId(
  accessToken: string,
  orgId: string,
  dataCenter: string,
  preferred: string | null
): Promise<string> {
  if (preferred?.trim()) return preferred.trim();
  const res = await deskFetch(accessToken, orgId, dataCenter, "/departments", {
    method: "GET",
  });
  const text = await res.text();
  let json: { data?: { id?: string }[] } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Desk /departments not JSON (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`Desk /departments ${res.status}: ${text.slice(0, 200)}`);
  }
  const first = json.data?.[0]?.id;
  if (!first) {
    throw new Error(
      "No departments returned from Zoho Desk — set a default department id in Settings."
    );
  }
  return first;
}

export async function createDeskTicket(params: {
  subject: string;
  description: string;
}): Promise<{ ticketId: string; ticketNumber: string }> {
  const c = await loadZohoDeskSettings();
  if (!c.clientId || !c.clientSecret || !c.refreshToken) {
    throw new Error(
      "Zoho Desk is not configured (client id, secret, and refresh token required)."
    );
  }
  if (!c.orgId?.trim()) {
    throw new Error("Zoho Desk organization id is required in Settings.");
  }

  const { access_token } = await refreshZohoAccessToken(c);
  const departmentId = await resolveDepartmentId(
    access_token,
    c.orgId.trim(),
    c.dataCenter,
    c.departmentId
  );

  const body = {
    subject: params.subject,
    departmentId,
    description: params.description,
  };

  const res = await deskFetch(access_token, c.orgId.trim(), c.dataCenter, "/tickets", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Desk create ticket not JSON (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.error === "string"
          ? json.error
          : text.slice(0, 200);
    throw new Error(`Desk API ${res.status}: ${msg}`);
  }

  const data = json as {
    id?: string;
    ticketNumber?: string;
  };
  const ticketId = data.id;
  const ticketNumber =
    data.ticketNumber != null ? String(data.ticketNumber) : "";
  if (!ticketId) {
    throw new Error("Desk API returned no ticket id");
  }

  return { ticketId, ticketNumber: ticketNumber || ticketId };
}

export async function createDeskTicketForRepair(params: {
  subject: string;
  description: string;
  referenceNumber: string;
}): Promise<{ ticketId: string; ticketNumber: string }> {
  return createDeskTicket({
    subject: params.subject,
    description: params.description,
  });
}

export async function testZohoDeskConnection(): Promise<{
  ok: true;
  departmentCount?: number;
}> {
  const c = await loadZohoDeskSettings();
  if (!c.clientId || !c.clientSecret) {
    throw new Error("Client ID and Client Secret are required.");
  }
  if (!c.refreshToken) {
    throw new Error("Refresh token is required (Desk OAuth with ticket scopes).");
  }
  if (!c.orgId?.trim()) {
    throw new Error("Organization id is required.");
  }

  const { access_token } = await refreshZohoAccessToken(c);
  const res = await deskFetch(
    access_token,
    c.orgId.trim(),
    c.dataCenter,
    "/departments",
    { method: "GET" }
  );
  const text = await res.text();
  let json: { data?: unknown[] } = {};
  try {
    json = JSON.parse(text) as { data?: unknown[] };
  } catch {
    throw new Error(`Desk test: not JSON (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`Desk API ${res.status}: ${text.slice(0, 250)}`);
  }

  return {
    ok: true,
    departmentCount: Array.isArray(json.data) ? json.data.length : 0,
  };
}

/** User input: strips # and whitespace — suitable for Desk path/query. */
export function normalizeDeskTicketLookup(raw: string): string {
  return raw.replace(/^#/, "").trim();
}

/**
 * Internal Desk ticket ids are long (15+ digit) numbers from the ticket URL.
 * Display ticket numbers (what users see, e.g. "1292") are short. We use this to
 * decide whether a value can be fetched directly via GET /tickets/{id} or must be
 * resolved through the Search API first.
 */
function looksLikeDeskTicketId(key: string): boolean {
  return /^\d{12,}$/.test(key);
}

/** True when a Desk error response indicates the OAuth token lacks a required scope. */
function isDeskScopeError(status: number, json: Record<string, unknown>): boolean {
  if (status !== 401 && status !== 403) return false;
  const code =
    typeof json.errorCode === "string" ? json.errorCode.toUpperCase() : "";
  return code.includes("OAUTHSCOPE") || code.includes("OAUTH_SCOPE");
}

async function deskJsonOrThrow(
  res: Response,
  context: string
): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`${context}: not JSON (${res.status}) ${text.slice(0, 160)}`);
  }
}

type DeskTicketLookupArgs = {
  accessToken: string;
  orgId: string;
  dataCenter: string;
};

/**
 * GET /api/v1/tickets/{ticket_id} — only accepts the long internal ticket id.
 * Returns null on 404 (id not found) so callers can fall back to a number search.
 */
async function getDeskTicketById(
  args: DeskTicketLookupArgs,
  id: string
): Promise<{ ticketId: string; ticketNumber: string } | null> {
  const res = await deskFetch(
    args.accessToken,
    args.orgId,
    args.dataCenter,
    `/tickets/${encodeURIComponent(id)}`,
    { method: "GET" }
  );

  if (res.status === 404) {
    await res.text().catch(() => "");
    return null;
  }

  const json = await deskJsonOrThrow(res, "Desk ticket lookup");
  const resolvedId =
    json.id !== undefined && json.id !== null ? String(json.id) : "";
  if (!res.ok || !resolvedId) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.errorCode === "string"
          ? String(json.errorCode)
          : "";
    throw new Error(`Desk ticket lookup ${res.status}${msg ? `: ${msg}` : ""}`);
  }

  const ticketNumber =
    json.ticketNumber !== undefined && json.ticketNumber !== null
      ? String(json.ticketNumber)
      : resolvedId;
  return { ticketId: resolvedId, ticketNumber };
}

/**
 * GET /api/v1/tickets/search?ticketNumber={n} — resolves a display ticket number
 * (e.g. "1292") to its internal id. Requires the `Desk.search.READ` scope.
 * Returns null when no ticket matches (Zoho replies 204 No Content).
 */
async function searchDeskTicketByNumber(
  args: DeskTicketLookupArgs,
  ticketNumber: string
): Promise<{ ticketId: string; ticketNumber: string } | null> {
  const qs = new URLSearchParams({ ticketNumber, limit: "1" });
  const res = await deskFetch(
    args.accessToken,
    args.orgId,
    args.dataCenter,
    `/tickets/search?${qs.toString()}`,
    { method: "GET" }
  );

  // Zoho returns 204 (no body) when the search yields no results.
  if (res.status === 204) {
    await res.text().catch(() => "");
    return null;
  }

  const json = await deskJsonOrThrow(res, "Desk ticket search");
  if (!res.ok) {
    if (isDeskScopeError(res.status, json)) {
      throw new Error(
        'Zoho Desk needs the "Desk.search.READ" permission to look up tickets by number. ' +
          "Reconnect Zoho Desk in Settings to grant it, or paste the long ticket id from the ticket URL."
      );
    }
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.errorCode === "string"
          ? String(json.errorCode)
          : "";
    throw new Error(`Desk ticket search ${res.status}${msg ? `: ${msg}` : ""}`);
  }

  const data = Array.isArray(json.data)
    ? (json.data as Array<Record<string, unknown>>)
    : [];
  const match =
    data.find((t) => String(t.ticketNumber ?? "") === ticketNumber) ?? data[0];
  const id = match?.id != null ? String(match.id) : "";
  if (!id) return null;

  const num =
    match?.ticketNumber != null ? String(match.ticketNumber) : ticketNumber;
  return { ticketId: id, ticketNumber: num };
}

/**
 * Resolve a Desk ticket from user input that may be either the long internal id
 * (from the ticket URL) or the short display ticket number (e.g. "1292").
 *
 * Order: long ids hit GET /tickets/{id} directly; everything else (and numeric ids
 * that 404 on the direct call) is resolved via the Search API by ticketNumber.
 */
export async function resolveDeskTicketByLookup(params: {
  accessToken: string;
  orgId: string;
  dataCenter: string;
  lookup: string;
}): Promise<{ ticketId: string; ticketNumber: string }> {
  const key = normalizeDeskTicketLookup(params.lookup);
  if (!key) {
    throw new Error("Enter a Desk ticket number or ticket id.");
  }

  const args: DeskTicketLookupArgs = {
    accessToken: params.accessToken,
    orgId: params.orgId,
    dataCenter: params.dataCenter,
  };

  // 1) Long internal id → direct fetch (cheapest, no search scope needed).
  if (looksLikeDeskTicketId(key)) {
    const byId = await getDeskTicketById(args, key);
    if (byId) return byId;
  }

  // 2) Display ticket number → resolve via Search API.
  if (/^\d+$/.test(key)) {
    const found = await searchDeskTicketByNumber(args, key);
    if (found) return found;
  }

  // 3) Fallback: try a direct fetch for anything not already attempted above.
  if (!looksLikeDeskTicketId(key)) {
    const byId = await getDeskTicketById(args, key);
    if (byId) return byId;
  }

  throw new Error(
    `Desk ticket "${key}" not found. Paste the numeric ticket number shown in Desk, or the long ticket id from the ticket URL.`
  );
}

/**
 * Posts a ticket comment (thread). Uses Desk.tickets.UPDATE scope.
 * isPublic=false = internal/agent comment — default for technician notes (not emailed to customer).
 */
export async function addDeskTicketComment(params: {
  accessToken: string;
  orgId: string;
  dataCenter: string;
  ticketId: string;
  html: string;
  isPublic?: boolean;
}): Promise<void> {
  const res = await deskFetch(
    params.accessToken,
    params.orgId,
    params.dataCenter,
    `/tickets/${encodeURIComponent(params.ticketId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify({
        content: params.html,
        contentType: "html",
        isPublic: params.isPublic ?? false,
      }),
    }
  );

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (!res.ok) {
      throw new Error(`Desk comment failed (${res.status}): ${text.slice(0, 280)}`);
    }
    throw new Error("Desk comment returned non-JSON");
  }

  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : typeof json.errorCode === "string"
          ? json.errorCode
          : text.slice(0, 200);
    throw new Error(`Desk API ${res.status}: ${msg}`);
  }
}

/**
 * Adds an internal (agent-only) thread comment after resolving ticket by id or ticket number.
 */
export async function postDeskInternalCommentByLookup(
  lookup: string,
  html: string
): Promise<{ ticketId: string; ticketNumber: string }> {
  const c = await loadZohoDeskSettings();
  if (!c.clientId || !c.clientSecret || !c.refreshToken) {
    throw new Error(
      "Zoho Desk is not configured (client id, secret, and refresh token required)."
    );
  }
  if (!c.orgId?.trim()) {
    throw new Error("Zoho Desk organization id is required in Settings.");
  }

  const { access_token } = await refreshZohoAccessToken(c);
  const resolved = await resolveDeskTicketByLookup({
    accessToken: access_token,
    orgId: c.orgId.trim(),
    dataCenter: c.dataCenter,
    lookup,
  });

  await addDeskTicketComment({
    accessToken: access_token,
    orgId: c.orgId.trim(),
    dataCenter: c.dataCenter,
    ticketId: resolved.ticketId,
    html,
    isPublic: false,
  });

  return resolved;
}

/** Internal comment when ticket id is already known (same Desk access token pipeline). */
export async function appendDeskInternalCommentForTicket(
  ticketId: string,
  html: string
): Promise<void> {
  const c = await loadZohoDeskSettings();
  if (!c.clientId || !c.clientSecret || !c.refreshToken) {
    throw new Error(
      "Zoho Desk is not configured (client id, secret, and refresh token required)."
    );
  }
  if (!c.orgId?.trim()) {
    throw new Error("Zoho Desk organization id is required in Settings.");
  }

  const { access_token } = await refreshZohoAccessToken(c);
  await addDeskTicketComment({
    accessToken: access_token,
    orgId: c.orgId.trim(),
    dataCenter: c.dataCenter,
    ticketId,
    html,
    isPublic: false,
  });
}

export async function linkRepairNotesToDeskTicket(params: {
  referenceNumber: string;
  assetName: string;
  serialNumber?: string | null;
  technicianNotes?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  lookup: string;
}): Promise<{ ticketId: string; ticketNumber: string }> {
  const c = await loadZohoDeskSettings();
  if (!c.clientId || !c.clientSecret || !c.refreshToken) {
    throw new Error(
      "Zoho Desk is not configured (client id, secret, and refresh token required)."
    );
  }
  if (!c.orgId?.trim()) {
    throw new Error("Zoho Desk organization id is required in Settings.");
  }

  const { access_token } = await refreshZohoAccessToken(c);
  const resolved = await resolveDeskTicketByLookup({
    accessToken: access_token,
    orgId: c.orgId.trim(),
    dataCenter: c.dataCenter,
    lookup: params.lookup,
  });

  const noteBlock = params.technicianNotes?.trim()
    ? `<p><strong>Technician notes:</strong></p><p>${escapeDeskHtml(params.technicianNotes.trim()).replace(/\n/g, "<br/>")}</p>`
    : "";

  const lines = [
    `<p><strong>Inventory repair</strong> ${escapeDeskHtml(params.referenceNumber)}.`,
    `<strong>Asset:</strong> ${escapeDeskHtml(params.assetName)}`,
  ];
  if (params.serialNumber?.trim()) {
    lines.push(`<strong>Serial:</strong> ${escapeDeskHtml(params.serialNumber.trim())}`);
  }
  const mm = [params.manufacturer, params.model].filter(Boolean).join(" ").trim();
  if (mm) {
    lines.push(`<strong>Make / model:</strong> ${escapeDeskHtml(mm)}`);
  }
  if (!params.technicianNotes?.trim()) {
    lines.push(`<em>Linked from inventory — add technician notes in the modal to include detail here.</em>`);
  }
  lines.push("</p>");

  const html = `${lines.join(" ")}${noteBlock}`;
  await addDeskTicketComment({
    accessToken: access_token,
    orgId: c.orgId.trim(),
    dataCenter: c.dataCenter,
    ticketId: resolved.ticketId,
    html,
    isPublic: false,
  });

  return resolved;
}

function escapeDeskHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
