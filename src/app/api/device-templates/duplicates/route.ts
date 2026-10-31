import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { buildDeviceTemplateLabel } from "@/lib/inventory/device-template-label";
import {
  DUPLICATE_KEPT_ACTION,
  findTemplateReviewItems,
  type TemplateForReview,
} from "@/lib/inventory/template-duplicates";

async function loadTemplatesForReview(): Promise<TemplateForReview[]> {
  const rows = await prisma.deviceTemplate.findMany({
    orderBy: [{ manufacturer: "asc" }, { model: "asc" }],
    include: { _count: { select: { assets: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    manufacturer: row.manufacturer,
    model: row.model,
    assetCount: row._count.assets,
  }));
}

async function loadDismissedKeys(): Promise<Set<string>> {
  const rows = await prisma.auditLog.findMany({
    where: { actionType: DUPLICATE_KEPT_ACTION },
    select: { metadata: true },
  });
  const keys = new Set<string>();
  for (const row of rows) {
    const meta = row.metadata as { key?: unknown } | null;
    if (meta && typeof meta.key === "string") keys.add(meta.key);
  }
  return keys;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const [templates, dismissed] = await Promise.all([
      loadTemplatesForReview(),
      loadDismissedKeys(),
    ]);
    return NextResponse.json({
      findings: findTemplateReviewItems(templates, dismissed),
      canResolve: auth.role === "super_admin" || auth.role === "admin",
    });
  } catch (error) {
    console.error("GET /api/device-templates/duplicates", error);
    return NextResponse.json(
      { error: "Failed to check for duplicate templates" },
      { status: 500 }
    );
  }
}

type ResolveBody =
  | { action: "keep_both"; key: string }
  | { action: "merge_templates"; key: string; keepId: string }
  | { action: "merge_manufacturer"; key: string; canonical: string };

function parseBody(raw: unknown): ResolveBody | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.key !== "string" || !body.key) return null;
  if (body.action === "keep_both") return { action: "keep_both", key: body.key };
  if (body.action === "merge_templates" && typeof body.keepId === "string") {
    return { action: "merge_templates", key: body.key, keepId: body.keepId };
  }
  if (body.action === "merge_manufacturer" && typeof body.canonical === "string") {
    return { action: "merge_manufacturer", key: body.key, canonical: body.canonical };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, role } = auth;
  if (role !== "super_admin" && role !== "admin") {
    return NextResponse.json(
      { error: "Only an admin can resolve possible duplicates" },
      { status: 403 }
    );
  }

  let body: ResolveBody | null;
  try {
    body = parseBody(await request.json());
  } catch {
    body = null;
  }
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const templates = await loadTemplatesForReview();
    const finding = findTemplateReviewItems(templates).find((f) => f.key === body.key);
    if (!finding) {
      return NextResponse.json(
        { error: "This item has changed since the list loaded. Refresh and try again." },
        { status: 409 }
      );
    }

    if (body.action === "keep_both") {
      await createAuditLog({
        userId: user.id,
        actionType: DUPLICATE_KEPT_ACTION,
        notes: `Kept as separate: ${finding.kind}`,
        metadata: { key: finding.key, kind: finding.kind },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "merge_templates") {
      if (finding.kind !== "template") {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const keep = finding.templates.find((t) => t.id === body.keepId);
      if (!keep) {
        return NextResponse.json({ error: "Choose a template from this group to keep" }, { status: 400 });
      }
      const mergeIds = finding.templates.filter((t) => t.id !== keep.id).map((t) => t.id);
      const moved = await prisma.$transaction(async (tx) => {
        const updated = await tx.asset.updateMany({
          where: { deviceTemplateId: { in: mergeIds } },
          data: { deviceTemplateId: keep.id },
        });
        await tx.deviceTemplate.deleteMany({ where: { id: { in: mergeIds } } });
        return updated.count;
      });
      await createAuditLog({
        userId: user.id,
        actionType: "device_template.merged",
        notes: keep.label,
        metadata: {
          keptTemplateId: keep.id,
          mergedTemplates: finding.templates
            .filter((t) => t.id !== keep.id)
            .map((t) => ({ id: t.id, label: t.label, manufacturer: t.manufacturer, model: t.model })),
          assetsMoved: moved,
        },
      });
      return NextResponse.json({ ok: true, assetsMoved: moved });
    }

    if (finding.kind !== "manufacturer") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const canonical = body.canonical;
    if (!finding.spellings.some((s) => s.manufacturer === canonical)) {
      return NextResponse.json({ error: "Choose one of the listed spellings" }, { status: 400 });
    }
    const variants = finding.spellings
      .map((s) => s.manufacturer)
      .filter((m) => m !== canonical);
    const takenModels = new Set(
      templates.filter((t) => t.manufacturer === canonical).map((t) => t.model)
    );
    const renamed: string[] = [];
    const skipped: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const template of templates.filter((t) => variants.includes(t.manufacturer))) {
        if (takenModels.has(template.model)) {
          skipped.push(template.label);
          continue;
        }
        await tx.deviceTemplate.update({
          where: { id: template.id },
          data: {
            manufacturer: canonical,
            label: buildDeviceTemplateLabel(canonical, template.model),
          },
        });
        takenModels.add(template.model);
        renamed.push(template.label);
      }
    });
    await createAuditLog({
      userId: user.id,
      actionType: "device_template.manufacturer_merged",
      notes: canonical,
      metadata: { canonical, variants, renamed, skipped },
    });
    return NextResponse.json({ ok: true, renamed: renamed.length, skipped });
  } catch (error) {
    console.error("POST /api/device-templates/duplicates", error);
    return NextResponse.json(
      { error: "Failed to resolve the duplicate" },
      { status: 500 }
    );
  }
}
