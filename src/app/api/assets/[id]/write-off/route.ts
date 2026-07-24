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
    replacementAssetName: optionalTrimmed,
    replacementAssetType: optionalTrimmed,
    replacementMakeModel: optionalTrimmed,
    replacementSerialNumber: optionalTrimmed,
    replacementXeroFixedAssetNumber: optionalTrimmed,
    assessmentId: z.string().trim().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.replacementRequested === true) {
      if (!val.replacementAssetName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Replacement asset name is required",
          path: ["replacementAssetName"],
        });
      }
      if (!val.replacementAssetType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Replacement asset type is required",
          path: ["replacementAssetType"],
        });
      }
      if (!val.replacementMakeModel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Replacement make / model is required",
          path: ["replacementMakeModel"],
        });
      }
      if (!val.replacementSerialNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Replacement serial number is required",
          path: ["replacementSerialNumber"],
        });
      }
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
      replacementAssetName: parsed.replacementAssetName,
      replacementAssetType: parsed.replacementAssetType,
      replacementMakeModel: parsed.replacementMakeModel,
      replacementSerialNumber: parsed.replacementSerialNumber,
      replacementXeroFixedAssetNumber: parsed.replacementXeroFixedAssetNumber,
      assessmentId: parsed.assessmentId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      asset: result.asset,
      certificateReference: result.certificateReference,
      ...(result.notifyFailed
        ? {
            warning: "Write-off saved, but finance notification failed.",
            notifyWarnings: ["write_off_notify_failed"],
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
