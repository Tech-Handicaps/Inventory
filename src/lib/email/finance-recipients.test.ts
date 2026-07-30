import { describe, expect, it } from "vitest";
import {
  applyEmailTemplate,
  greetingLineForRecipient,
  parseFinanceRecipients,
  resolveRecipientDisplayName,
} from "@/lib/email/finance-recipients";

describe("parseFinanceRecipients", () => {
  it("parses plain emails and Name <email>", () => {
    const list = parseFinanceRecipients(
      `Jane Smith <jane@handicaps.co.za>, finance@handicaps.co.za\n"Audit Desk" <audit@handicaps.co.za>`
    );
    expect(list).toEqual([
      { email: "jane@handicaps.co.za", name: "Jane Smith" },
      { email: "finance@handicaps.co.za", name: null },
      { email: "audit@handicaps.co.za", name: "Audit Desk" },
    ]);
  });

  it("dedupes by email", () => {
    const list = parseFinanceRecipients(
      "a@b.co, Jane <a@b.co>"
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.email).toBe("a@b.co");
  });
});

describe("greetingLineForRecipient", () => {
  it("uses recipient name then fallback", () => {
    expect(
      greetingLineForRecipient(
        { email: "j@x.co", name: "Jane" },
        "Finance team"
      )
    ).toBe("Hi Jane,");
    expect(
      greetingLineForRecipient(
        { email: "f@x.co", name: null },
        "Finance team"
      )
    ).toBe("Hi Finance team,");
  });

  it("supports Hi {name}, template", () => {
    expect(
      greetingLineForRecipient(
        { email: "j@x.co", name: "Jane" },
        "Hi {name},"
      )
    ).toBe("Hi Jane,");
  });
});

describe("applyEmailTemplate", () => {
  it("replaces tokens", () => {
    expect(
      applyEmailTemplate("Hi {name} — {month}", {
        name: "Jane",
        email: "j@x.co",
        month: "July 2026",
      })
    ).toBe("Hi Jane — July 2026");
  });
});

describe("resolveRecipientDisplayName", () => {
  it("defaults to Finance team", () => {
    expect(
      resolveRecipientDisplayName({ email: "a@b.co", name: null }, null)
    ).toBe("Finance team");
  });
});
