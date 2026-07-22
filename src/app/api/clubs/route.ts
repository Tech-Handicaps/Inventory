import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError, jsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { prismaMutationError } from "@/lib/prisma/error-response";
import { prisma } from "@/lib/prisma";

const createClubSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const clubs = await prisma.club.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(clubs);
  } catch (error) {
    return catchToJsonError("GET /api/clubs", error, "Failed to fetch clubs");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const parsed = await parseJsonBody(request, createClubSchema);
    if (isNextResponse(parsed)) return parsed;

    const created = await prisma.club.create({
      data: { name: parsed.name },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "club.created",
      notes: created.name,
      metadata: { clubId: created.id },
    });

    return NextResponse.json(created);
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError("A club with this name already exists", 409, {
        prismaCode: error.code,
      });
    }
    const { status, body } = prismaMutationError(error, "Failed to create club");
    console.error("POST /api/clubs", error);
    return NextResponse.json(body, { status });
  }
}
