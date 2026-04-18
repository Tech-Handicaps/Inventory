import { prisma } from "@/lib/prisma";
import { type ZohoDataCenter } from "@/lib/zoho/constants";

export { ZOHO_DATA_CENTERS, type ZohoDataCenter } from "@/lib/zoho/constants";

const ACCOUNTS_BASE: Record<ZohoDataCenter, string> = {
  us: "https://accounts.zoho.com",
  eu: "https://accounts.zoho.eu",
  in: "https://accounts.zoho.in",
  au: "https://accounts.zoho.com.au",
  ca: "https://accounts.zohocloud.ca",
  jp: "https://accounts.zoho.jp",
  sa: "https://accounts.zoho.sa",
};

export const ZOHO_ASSIST_API_BASE = "https://assist.zoho.com/api/v2";

/** Assist GET /api/v2/devices — `count` must be 1–50 per Zoho docs (default 25). */
export const ZOHO_ASSIST_DEVICES_MAX_COUNT = 50;

/** Scopes for Assist user info + unattended devices (future sync). */
export const ZOHO_ASSIST_OAUTH_SCOPES =
  "ZohoAssist.userapi.READ,ZohoAssist.unattended.computer.READ";

export function getAccountsBaseUrl(dataCenter: string): string {
  const dc = (dataCenter in ACCOUNTS_BASE
    ? dataCenter
    : "us") as ZohoDataCenter;
  return ACCOUNTS_BASE[dc] ?? ACCOUNTS_BASE.us;
}

/** Shared OAuth fields for Zoho Accounts token refresh (Assist, Desk, …). */
export type ZohoOAuthCredentials = {
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  dataCenter: string;
};

/** Assist settings row: OAuth + optional API header defaults. */
export type ZohoCredentials = ZohoOAuthCredentials & {
  defaultOrgId: string | null;
  defaultDepartmentId: string | null;
};

export async function loadZohoAssistSettings(): Promise<ZohoCredentials> {
  const row = await prisma.zohoAssistSettings.findUnique({
    where: { id: "singleton" },
  });
  return {
    clientId: row?.clientId ?? process.env.ZOHO_CLIENT_ID ?? null,
    clientSecret: row?.clientSecret ?? process.env.ZOHO_CLIENT_SECRET ?? null,
    refreshToken: row?.refreshToken ?? process.env.ZOHO_REFRESH_TOKEN ?? null,
    dataCenter: row?.dataCenter ?? process.env.ZOHO_DATA_CENTER ?? "us",
    defaultOrgId: row?.defaultOrgId ?? null,
    defaultDepartmentId: row?.defaultDepartmentId ?? null,
  };
}

function maskSecret(value: string | null | undefined, visible = 4): string | null {
  if (!value || value.length === 0) return null;
  if (value.length <= visible) return "•".repeat(value.length);
  return `••••••${value.slice(-visible)}`;
}

export function maskZohoSecrets(c: ZohoOAuthCredentials) {
  return {
    clientId: c.clientId,
    clientSecretMasked: maskSecret(c.clientSecret),
    hasClientSecret: !!(c.clientSecret && c.clientSecret.length > 0),
    refreshTokenMasked: maskSecret(c.refreshToken),
    hasRefreshToken: !!(c.refreshToken && c.refreshToken.length > 0),
    dataCenter: c.dataCenter,
    configured:
      !!(c.clientId && c.clientSecret) &&
      !!(c.refreshToken && c.refreshToken.length > 0),
  };
}

export async function refreshZohoAccessToken(c: ZohoOAuthCredentials): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const accounts = getAccountsBaseUrl(c.dataCenter);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: c.refreshToken!,
    client_id: c.clientId!,
    client_secret: c.clientSecret!,
  });

  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Token response not JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err =
      typeof json.error === "string"
        ? json.error
        : `HTTP ${res.status}`;
    const desc = typeof json.error_description === "string" ? json.error_description : text;
    throw new Error(`${err}: ${desc}`);
  }

  const access_token = json.access_token;
  if (typeof access_token !== "string" || !access_token) {
    throw new Error("Token response missing access_token");
  }

  return {
    access_token,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : undefined,
  };
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  dataCenter: string;
}): Promise<{ refresh_token?: string; access_token: string }> {
  const accounts = getAccountsBaseUrl(params.dataCenter);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });

  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Token response not JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err =
      typeof json.error === "string"
        ? json.error
        : `HTTP ${res.status}`;
    const desc = typeof json.error_description === "string" ? json.error_description : text;
    throw new Error(`${err}: ${desc}`);
  }

  const access_token = json.access_token;
  if (typeof access_token !== "string") {
    throw new Error("Token response missing access_token");
  }

  return {
    access_token,
    refresh_token:
      typeof json.refresh_token === "string" ? json.refresh_token : undefined,
  };
}

/** GET https://assist.zoho.com/api/v2/user — requires ZohoAssist.userapi.READ */
export async function fetchAssistUser(accessToken: string): Promise<unknown> {
  const res = await fetch(`${ZOHO_ASSIST_API_BASE}/user`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Assist /user not JSON (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const j = json as Record<string, unknown>;
    const msg =
      typeof j.message === "string"
        ? j.message
        : typeof j.error === "string"
          ? j.error
          : text.slice(0, 200);
    throw new Error(`Assist API ${res.status}: ${msg}`);
  }

  return json;
}

/**
 * GET https://assist.zoho.com/api/v2/devices/{resource_id}
 * Requires ZohoAssist.unattended.computer.READ
 */
export async function fetchAssistDeviceDetails(
  accessToken: string,
  resourceId: string,
  options: { departmentId: string; orgId?: string | null }
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
    "x-com-zoho-assist-department-id": options.departmentId,
  };
  if (options.orgId) {
    headers["x-com-zoho-assist-orgid"] = options.orgId;
  }

  const res = await fetch(`${ZOHO_ASSIST_API_BASE}/devices/${encodeURIComponent(resourceId)}`, {
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Assist device details not JSON (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const j = json as Record<string, unknown>;
    const msg =
      typeof j.message === "string"
        ? j.message
        : typeof j.error === "string"
          ? j.error
          : text.slice(0, 200);
    throw new Error(`Assist API ${res.status}: ${msg}`);
  }

  return json;
}

/**
 * GET https://assist.zoho.com/api/v2/devices — unattended computer list.
 * @see https://www.zoho.com/assist/api/getunattendedcomputer.html
 */
export async function fetchAssistDevicesList(
  accessToken: string,
  options: {
    departmentId: string;
    orgId?: string | null;
    index?: number;
    count?: number;
    displayName?: string;
    deviceName?: string;
  }
): Promise<unknown> {
  const params = new URLSearchParams();
  params.set("index", String(options.index ?? 1));
  const c = Math.min(
    Math.max(options.count ?? 25, 1),
    ZOHO_ASSIST_DEVICES_MAX_COUNT
  );
  params.set("count", String(c));
  if (options.displayName?.trim()) {
    params.set("display_name", options.displayName.trim());
  }
  if (options.deviceName?.trim()) {
    params.set("device_name", options.deviceName.trim());
  }

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
    "x-com-zoho-assist-department-id": options.departmentId,
  };
  if (options.orgId) {
    headers["x-com-zoho-assist-orgid"] = options.orgId;
  }

  const url = `${ZOHO_ASSIST_API_BASE}/devices?${params.toString()}`;
  const res = await fetch(url, { headers, cache: "no-store" });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Assist devices list not JSON (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const j = json as Record<string, unknown>;
    const msg =
      typeof j.message === "string"
        ? j.message
        : typeof j.error === "string"
          ? j.error
          : text.slice(0, 200);
    throw new Error(`Assist API ${res.status}: ${msg}`);
  }

  return json;
}

export async function testZohoAssistConnection(): Promise<{
  ok: true;
  userSample: unknown;
  tokenExpiresIn?: number;
}> {
  const c = await loadZohoAssistSettings();
  if (!c.clientId || !c.clientSecret) {
    throw new Error(
      "Client ID and Client Secret are required (save them in Settings or set ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET)."
    );
  }
  if (!c.refreshToken) {
    throw new Error(
      "No refresh token. Use “Connect Zoho Account” or paste a refresh token from the Zoho API Console (Self Client)."
    );
  }

  const { access_token, expires_in } = await refreshZohoAccessToken(c);
  const user = await fetchAssistUser(access_token);

  return {
    ok: true,
    userSample: user,
    tokenExpiresIn: expires_in,
  };
}
