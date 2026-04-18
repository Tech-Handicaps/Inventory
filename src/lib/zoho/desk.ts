import { prisma } from "@/lib/prisma";
import {
  maskZohoSecrets,
  refreshZohoAccessToken,
  type ZohoOAuthCredentials,
} from "@/lib/zoho/client";
import { type ZohoDataCenter } from "@/lib/zoho/constants";

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

export async function createDeskTicketForRepair(params: {
  subject: string;
  description: string;
  referenceNumber: string;
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
