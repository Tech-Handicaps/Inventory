#!/usr/bin/env node
/**
 * Downloads MaxMind GeoLite2-City (location) and GeoLite2-ASN (internet provider) into data/geoip/
 * before `next build` (npm "prebuild").
 *
 * Needs MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY. Without them the build fails, except where
 * GEOLITE_SKIP_DOWNLOAD=1 is set outside Vercel (GitHub CI); GeoIP lookups are then off at runtime.
 * A download younger than 24 h is reused from node_modules/.cache so frequent builds stay well
 * inside MaxMind's daily download limit; the weekly redeploy always gets a fresh copy.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Reader } from "@maxmind/geoip2-node";

const EDITIONS = [
  {
    id: "GeoLite2-City",
    check: (reader) => {
      const country = reader.city("8.8.8.8").country?.isoCode;
      return { ok: country === "US", detail: `8.8.8.8 → ${country ?? "nothing"} (expected US)` };
    },
  },
  {
    id: "GeoLite2-ASN",
    check: (reader) => {
      const asn = reader.asn("8.8.8.8").autonomousSystemNumber;
      return { ok: asn === 15169, detail: `8.8.8.8 → AS${asn ?? "?"} (expected AS15169)` };
    },
  },
];
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "geoip");
const CACHE_DIR = path.join(ROOT, "node_modules", ".cache", "geolite2");
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

function fail(message) {
  console.error(`\n[fetch-geolite] ${message}\n`);
  process.exit(1);
}

function findMmdb(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMmdb(p);
      if (found) return found;
    } else if (entry.name.endsWith(".mmdb")) {
      return p;
    }
  }
  return null;
}

function credentials() {
  const accountId = process.env.MAXMIND_ACCOUNT_ID?.trim();
  const licenseKey = process.env.MAXMIND_LICENSE_KEY?.trim();
  if (accountId && licenseKey) return { accountId, licenseKey };
  if (process.env.GEOLITE_SKIP_DOWNLOAD === "1" && !process.env.VERCEL) {
    console.warn("[fetch-geolite] GEOLITE_SKIP_DOWNLOAD=1 and no MaxMind credentials: skipping. GeoIP lookups will be off.");
    return null;
  }
  fail(
    "MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY must be set to download GeoLite2.\n" +
      "Set them in Vercel (Project → Settings → Environment Variables) or in .env / .env.local for local builds."
  );
}

async function download(edition, cacheFile, { accountId, licenseKey }) {
  const url = `https://download.maxmind.com/geoip/databases/${edition}/download?suffix=tar.gz`;
  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString("base64");
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, redirect: "follow" });
  } catch (e) {
    fail(`Could not reach download.maxmind.com: ${e instanceof Error ? e.message : e}`);
  }
  if (res.status === 401) fail("MaxMind rejected the credentials (HTTP 401). Check MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY.");
  if (res.status === 429) fail("MaxMind daily download limit reached (HTTP 429). Try again later.");
  if (!res.ok) fail(`MaxMind download of ${edition} failed with HTTP ${res.status}.`);

  const work = mkdtempSync(path.join(tmpdir(), "geolite-"));
  try {
    const archive = path.join(work, "db.tar.gz");
    writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    const tar = spawnSync("tar", ["-xzf", archive, "-C", work], { stdio: "inherit" });
    if (tar.status !== 0) fail(`Could not extract the ${edition} archive (tar failed).`);
    const mmdb = findMmdb(work);
    if (!mmdb) fail(`The ${edition} archive did not contain an .mmdb file.`);
    console.log(`[fetch-geolite] Downloaded ${path.basename(path.dirname(mmdb))}.`);
    mkdirSync(path.dirname(cacheFile), { recursive: true });
    copyFileSync(mmdb, cacheFile);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main() {
  let creds;
  for (const { id, check } of EDITIONS) {
    const cacheFile = path.join(CACHE_DIR, `${id}.mmdb`);
    const outFile = path.join(OUT_DIR, `${id}.mmdb`);
    const cacheFresh = existsSync(cacheFile) && Date.now() - statSync(cacheFile).mtimeMs < MAX_CACHE_AGE_MS;
    if (cacheFresh) {
      console.log(`[fetch-geolite] Reusing ${id} downloaded in the last 24 h.`);
    } else {
      creds ??= credentials();
      if (!creds) return;
      await download(id, cacheFile, creds);
    }

    mkdirSync(OUT_DIR, { recursive: true });
    copyFileSync(cacheFile, outFile);

    const result = check(await Reader.open(outFile));
    if (!result.ok) fail(`Sanity check failed for ${id}: ${result.detail}.`);
    const mb = (statSync(outFile).size / 1024 / 1024).toFixed(1);
    console.log(`[fetch-geolite] ${id} ready (${mb} MB); ${result.detail.replace(/ \(expected .*\)$/, "")}.`);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
