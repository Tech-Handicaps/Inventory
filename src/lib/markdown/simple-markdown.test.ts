import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@/lib/markdown/simple-markdown";

describe("markdownToHtml", () => {
  it("renders headings, lists, emphasis and tables", () => {
    const html = markdownToHtml(
      "## Title\n\nSome **bold** and *italic* text.\n\n- one\n- two\n\n1. first\n\n| A | B |\n|---|---|\n| x | y |"
    );
    expect(html).toContain("<h3>Title</h3>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>first</li></ol>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>y</td>");
  });

  it("escapes HTML in the source", () => {
    const html = markdownToHtml('<script>alert("x")</script> **<b>**');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>&lt;b&gt;</strong>");
  });
});
