/**
 * Section 2 of the notes for auditors ("From 132 units to 136 assets") was built from the December 2025 workbook,
 * so its dongle memo line read 12. The bridge and the May 2026 hand-over use the 31 Jan 2026 count, where the
 * dongle line (a formula copying Posiflex PS-3316E, row 52 = row 19) is 11. Both workbooks were re-read on
 * 2 Nov 2026: Dec 2025 dongle 12, Jan 2026 dongle 11, modems 57, brackets 32, total 132.
 *
 * Saves the corrected text as the next notes version; earlier versions, including the signed text, are kept.
 * Idempotent: does nothing once the text is corrected. Dry run unless --apply.
 * Run with: npx tsx scripts/fix-auditor-notes-jan-basis.ts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const KEY = "auditor-notes";

const REPLACEMENTS: [string, string][] = [
  [
    "Prepared 31 Oct 2026*",
    "Prepared 31 Oct 2026 · Corrected 2 Nov 2026: section 2 now uses the 31 Jan 2026 count*",
  ],
  [
    "The December 2025 workbook counts 132 units by quantity.",
    "The 31 January 2026 workbook, the last prior-company count and the basis of the May 2026 hand-over, counts 132 units by quantity.",
  ],
  [
    "| Prior-company count, Dec 2025 | 132 | Quantity only, no serials |",
    "| Prior-company count, 31 Jan 2026 | 132 | Quantity only, no serials. Same total as Dec 2025; the mix by model differs |",
  ],
  [
    "| Included in it: modems and routers | ≈ 57 |",
    "| Included in it: modems and routers | 57 |",
  ],
  [
    "| Not included: Mecer UST-TP01 WiFi dongles (memo) | 12 | Derived from the Posiflex line, not counted. Since written off in full and not tracked |",
    "| Not included: Mecer UST-TP01 WiFi dongles (memo) | 11 | Derived from the Posiflex line (11 on 31 Jan 2026; 12 on the Dec 2025 workbook), not counted. Since written off in full and not tracked |",
  ],
  [
    "A detailed line-by-line reconciliation, including additions, write-offs and any unexplained difference, will be added as a reconciliation page in the system.",
    "The line-by-line reconciliation, with every part of the difference to the register itemised, is on the Reconciliation page and in its PDF.",
  ],
];

function loadEnv() {
  const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  let raw = process.env.DATABASE_URL ?? "";
  if (raw.startsWith("postgres://")) raw = `postgresql://${raw.slice("postgres://".length)}`;
  const url = new URL(raw);
  if (url.port === "6543") url.port = "5432";
  url.searchParams.delete("pgbouncer");
  url.searchParams.delete("connection_limit");
  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: loadEnv() } } });
  const log = (msg: string) => console.log(`${APPLY ? "" : "[dry run] "}${msg}`);
  try {
    const note = await prisma.reportNote.findUnique({ where: { key: KEY } });
    if (!note) throw new Error("No notes for auditors saved yet");
    let markdown = note.markdown;
    let changed = 0;
    for (const [from, to] of REPLACEMENTS) {
      if (markdown.includes(to)) continue;
      const hits = markdown.split(from).length - 1;
      if (hits !== 1) throw new Error(`Expected the text once, found it ${hits} time(s): ${from.slice(0, 70)}…`);
      markdown = markdown.replace(from, to);
      changed += 1;
      log(`replace: ${from.slice(0, 70)}…`);
    }
    if (changed === 0) {
      log(`already corrected (version ${note.version})`);
      return;
    }
    const version = note.version + 1;
    log(`save as version ${version} (${changed} change(s))`);
    if (!APPLY) return;
    await prisma.$transaction([
      prisma.reportNote.update({
        where: { key: KEY },
        data: {
          markdown,
          version,
          updatedBy: "system",
          versions: { create: { version, title: note.title, markdown, savedBy: "system" } },
        },
      }),
      prisma.auditLog.create({
        data: {
          actionType: "report.notes_updated",
          notes: `Notes for auditors and finance saved as version ${version}: section 2 corrected to the 31 Jan 2026 count (dongle memo line 11, not 12; modems 57).`,
          metadata: {
            key: KEY,
            version,
            previousVersion: note.version,
            reason: "The bridge and hand-over use the 31 Jan 2026 count; section 2 had used the Dec 2025 workbook.",
          },
        },
      }),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
