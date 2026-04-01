/**
 * Uploads public/brand/hna-logo.png to Supabase Storage (service role).
 *
 * Prereqs:
 * 1. In Supabase Dashboard → Storage → New bucket (e.g. name: `brand`).
 * 2. For public read of the logo: bucket → Public bucket, or add a policy so
 *    `anon` can SELECT on `brand/hna-logo.png`.
 * 3. `.env` with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage: npx tsx scripts/upload-brand-logo.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import path from "path";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main() {
  loadDotEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BRAND_BUCKET ?? "brand";
  const objectPath = process.env.SUPABASE_BRAND_LOGO_PATH ?? "hna-logo.png";

  if (!url || !serviceKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
    process.exit(1);
  }

  const filePath = path.join(process.cwd(), "public", "brand", "hna-logo.png");
  if (!existsSync(filePath)) {
    console.error("Missing file:", filePath);
    process.exit(1);
  }

  const buf = readFileSync(filePath);
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buf, {
    contentType: "image/png",
    upsert: true,
  });

  if (error) {
    console.error("Upload failed:", error.message);
    console.error(
      `\nCreate bucket "${bucket}" in Supabase → Storage (public read if you need a URL in the browser), then re-run.`
    );
    process.exit(1);
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  console.log("Uploaded to Supabase Storage:", `${bucket}/${objectPath}`);
  console.log("Public URL (if bucket is public):", pub.publicUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
