import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { writeOffAsset } from "@/lib/finance/write-off-asset";

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const writeOffSchema = z
  .object({
    reason: z.string().min(1, "reason is required"),
    serialNumber: z.string().nullable().optional(),
    xeroFixedAssetNumber: optionalTrimmed,
    replacementRequested: z.boolean().optional(),
    replacementNotes: z.string().optional(),
    replacementSource: z.enum(["stock", "procure"]).optional(),
    replacementStockAssetId: optionalTrimmed,
    replacementDeviceTemplateId: optionalTrimmed,
    replacementXeroFixedAssetNumber: optionalTrimmed,
    assessmentId: z.string().trim().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.replacementRequested !== true) return;
    if (val.replacementSource === "stock" && !val.replacementStockAssetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick the replacement unit from New Stock / Refurbished",
        path: ["replacementStockAssetId"],
      });
    } else if (
      val.replacementSource === "procure" &&
      !val.replacementDeviceTemplateId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick the model to procure",
        path: ["replacementDeviceTemplateId"],
      });
    } else if (!val.replacementSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a stock unit or a model to procure",
        path: ["replacementSource"],
      });
    }
  });

/** POST /api/assets/:id/write-off — structured write-off from Assessment/Maintenance or In Repairs */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const { id } = await params;
    const parsed = await parseJsonBody(request, writeOffSchema);
    if (isNextResponse(parsed)) return parsed;

    const result = await writeOffAsset({
      assetId: id,
      userId: user.id,
      reason: parsed.reason,
      serialNumber: parsed.serialNumber,
      xeroFixedAssetNumber: parsed.xeroFixedAssetNumber,
      replacementRequested: parsed.replacementRequested === true,
      replacementNotes: parsed.replacementNotes,
      replacement:
        parsed.replacementRequested !== true
          ? undefined
          : parsed.replacementSource === "stock"
            ? {
                source: "stock",
                stockAssetId: parsed.replacementStockAssetId ?? "",
              }
            : {
                source: "procure",
                deviceTemplateId: parsed.replacementDeviceTemplateId ?? "",
              },
      replacementXeroFixedAssetNumber: parsed.replacementXeroFixedAssetNumber,
      assessmentId: parsed.assessmentId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const warnings: string[] = [];
    if (result.notifyFailed) warnings.push("write_off_notify_failed");
    if (result.assistDeleteWarning) warnings.push("assist_delete_failed");

    return NextResponse.json({
      asset: result.asset,
      certificateReference: result.certificateReference,
      retiredAs: result.retiredAs,
      ...(result.assistDeleteWarning
        ? { assistDeleteWarning: result.assistDeleteWarning }
        : {}),
      ...(warnings.length > 0
        ? {
            warning: [
              result.notifyFailed
                ? "Write-off saved, but finance notification failed."
                : null,
              result.assistDeleteWarning
                ? `Write-off saved and Assist was unlinked here, but Zoho Assist delete failed: ${result.assistDeleteWarning}`
                : null,
            ]
              .filter(Boolean)
              .join(" "),
            notifyWarnings: warnings,
          }
        : {}),
    });
  } catch (e) {
    return catchToJsonError(
      "POST /api/assets/[id]/write-off",
      e,
      "Write-off failed"
    );
  }
}
