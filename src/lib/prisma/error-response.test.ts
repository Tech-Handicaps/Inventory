import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prismaMutationError } from "@/lib/prisma/error-response";
import { publicErrorMessage } from "@/lib/api/error-response";

describe("prismaMutationError", () => {
  it("maps unique conflicts to 409", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
    });
    const mapped = prismaMutationError(err, "fallback");
    expect(mapped.status).toBe(409);
    expect(mapped.body.error).toMatch(/already exists/i);
  });

  it("uses fallback for unknown errors", () => {
    const mapped = prismaMutationError(new Error("boom"), "Failed");
    expect(mapped.status).toBe(500);
    expect(mapped.body.error).toBe("Failed");
  });
});

describe("publicErrorMessage", () => {
  it("hides prisma/connection internals", () => {
    expect(publicErrorMessage(new Error("Prisma timeout"), "Request failed")).toBe(
      "Request failed"
    );
    expect(publicErrorMessage(new Error("Invalid club name"), "Request failed")).toBe(
      "Invalid club name"
    );
  });
});
