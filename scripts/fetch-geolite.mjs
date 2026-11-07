#!/usr/bin/env node
/**
 * Downloads MaxMind GeoLite2-City into data/geoip/ before `next build` (npm "prebuild").
 *
 * Needs MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY. Without them the build fails, except where
 * GEOLITE_SKIP_DOWNLOAD=1 is set outside Vercel (GitHub CI); geolocation is then off at runtime.
 * A download younger than 24 h is reused from node_modules/.cache so frequent builds stay well
 * inside MaxMind's daily download limit; the weekly redeploy always gets a fresh copy.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Reader } from "@maxmind/geoip2-node";

const EDITION = "GeoLite2-City";
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "geoip");
const OUT_FILE = path.join(OUT_DIR, `${EDITION}.mmdb`);
const CACHE_FILE = path.join(ROOT, "node_modules", ".cache", "geolite2", `${EDITION}.mmdb`);
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

async function download() {
  const accountId = process.env.MAXMIND_ACCOUNT_ID?.trim();
  const licenseKey = process.env.MAXMIND_LICENSE_KEY?.trim();
  if (!accountId || !licenseKey) {
    if (process.env.GEOLITE_SKIP_DOWNLOAD === "1" && !process.env.VERCEL) {
      console.warn("[fetch-geolite] GEOLITE_SKIP_DOWNLOAD=1 and no MaxMind credentials: skipping. IP geolocation will be off.");
      return false;
    }
    fail(
      "MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY must be set to download GeoLite2-City.\n" +
        "Set them in Vercel (Project → Settings → Environment Variables) or in .env.local for local builds."
    );
  }

  const url = `https://download.maxmind.com/geoip/databases/${EDITION}/download?suffix=tar.gz`;
  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString("base64");
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, redirect: "follow" });
  } catch (e) {
    fail(`Could not reach download.maxmind.com: ${e instanceof Error ? e.message : e}`);
  }
  if (res.status === 401) fail("MaxMind rejected the credentials (HTTP 401). Check MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY.");
  if (res.status === 429) fail("MaxMind daily download limit reached (HTTP 429). Try again later.");
  if (!res.ok) fail(`MaxMind download failed with HTTP ${res.status}.`);

  const work = mkdtempSync(path.join(tmpdir(), "geolite-"));
  try {
    const archive = path.join(work, "db.tar.gz");
    writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    const tar = spawnSync("tar", ["-xzf", archive, "-C", work], { stdio: "inherit" });
    if (tar.status !== 0) fail("Could not extract the GeoLite2 archive (tar failed).");
    const mmdb = findMmdb(work);
    if (!mmdb) fail("The GeoLite2 archive did not contain an .mmdb file.");
    console.log(`[fetch-geolite] Downloaded ${path.basename(path.dirname(mmdb))}.`);
    mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    copyFileSync(mmdb, CACHE_FILE);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return true;
}

async function main() {
  const cacheFresh = existsSync(CACHE_FILE) && Date.now() - statSync(CACHE_FILE).mtimeMs < MAX_CACHE_AGE_MS;
  if (cacheFresh) {
    console.log("[fetch-geolite] Reusing GeoLite2-City downloaded in the last 24 h.");
  } else if (!(await download())) {
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  copyFileSync(CACHE_FILE, OUT_FILE);

  const reader = await Reader.open(OUT_FILE);
  const country = reader.city("8.8.8.8").country?.isoCode;
  if (country !== "US") fail(`Sanity check failed: 8.8.8.8 resolved to ${country ?? "nothing"}, expected US.`);
  const mb = (statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`[fetch-geolite] ${EDITION} ready (${mb} MB); 8.8.8.8 → ${country}.`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
