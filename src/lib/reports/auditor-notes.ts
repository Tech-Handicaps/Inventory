import { revalidateTag, unstable_cache } from "next/cache";
import { escHtml } from "@/lib/pdf/chromium-pdf";
import { formatDateTime } from "@/lib/dates/format";
import { markdownToHtml } from "@/lib/markdown/simple-markdown";
import { prisma } from "@/lib/prisma";
import { anyNotesFirst } from "@/lib/reports/period-catalog";
import { AUDITOR_NOTES_KEY, AUDITOR_NOTES_SEED } from "@/lib/reports/prior-company-seed";

export const REPORT_NOTES_TAG = "report-notes";

export type AuditorNotes = {
  title: string;
  markdown: string;
  version: number;
  updatedAt: string | null;
};

const loadCached = unstable_cache(
  async (): Promise<AuditorNotes> => {
    const note = await prisma.reportNote.findUnique({ where: { key: AUDITOR_NOTES_KEY } });
    if (!note) return { ...AUDITOR_NOTES_SEED, version: 0, updatedAt: null };
    return {
      title: note.title,
      markdown: note.markdown,
      version: note.version,
      updatedAt: note.updatedAt.toISOString(),
    };
  },
  ["report-notes", AUDITOR_NOTES_KEY],
  { tags: [REPORT_NOTES_TAG], revalidate: 3600 }
);

export function loadAuditorNotes(): Promise<AuditorNotes> {
  return loadCached();
}

export function invalidateAuditorNotes() {
  try {
    revalidateTag(REPORT_NOTES_TAG, { expire: 0 });
  } catch {
    /* outside a request */
  }
}

export function notesVersionLine(notes: AuditorNotes): string {
  if (!notes.updatedAt) return "Draft – not yet saved";
  return `Version ${notes.version} · last updated ${formatDateTime(notes.updatedAt)}`;
}

/** Page 1 of a PDF: the notes, then a page break. */
export function notesPrefaceHtml(notes: AuditorNotes): string {
  return `<section class="notes-preface">
    <h1>${escHtml(notes.title)}</h1>
    <p class="subtitle">${escHtml(notesVersionLine(notes))}</p>
    <div class="notes-body">${markdownToHtml(notes.markdown)}</div>
  </section>`;
}

/** The Notes page for a PDF covering these months, or null when none is before Oct 2026. */
export async function notesPrefaceFor(monthKeys: string[]): Promise<string | null> {
  if (!anyNotesFirst(monthKeys)) return null;
  return notesPrefaceHtml(await loadAuditorNotes());
}
