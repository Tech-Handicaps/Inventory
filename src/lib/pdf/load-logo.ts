import { existsSync, readFileSync } from "fs";
import path from "path";

const REL = ["public", "brand", "hna-logo.png"] as const;

/**
 * Loads `public/brand/hna-logo.png` for PDF rendering.
 * Tries filesystem paths (dev + serverless), then fetches from the deployed site
 * so production works when the file is not bundled next to the route handler.
 */
export async function loadLogoForPdf(): Promise<Buffer | null> {
  const candidates = [
    path.join(/* turbopackIgnore: true */ process.cwd(), ...REL),
    path.join(
      /* turbopackIgnore: true */ process.cwd(),
      ".next",
      "standalone",
      ...REL
    ),
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const buf = readFileSync(p);
        if (buf.length > 0) return buf;
      } catch {
        /* try next */
      }
    }
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (base) {
    try {
      const res = await fetch(`${base}/brand/hna-logo.png`, {
        cache: "no-store",
      });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        const buf = Buffer.from(ab);
        if (buf.length > 0) return buf;
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}
