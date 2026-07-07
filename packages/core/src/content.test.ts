import { describe, expect, it } from "vitest";
import {
  createChapterStarterHtml,
  createHtmlContentDocument,
  hashText,
} from "./content";

describe("chapter content helpers", () => {
  it("creates deterministic content hashes", () => {
    expect(hashText("同一段正文")).toBe(hashText("同一段正文"));
    expect(hashText("同一段正文")).not.toBe(hashText("另一段正文"));
  });

  it("wraps HTML content without mutation", () => {
    expect(createHtmlContentDocument("<p>正文</p>")).toEqual({
      format: "html",
      html: "<p>正文</p>",
    });
  });

  it("escapes chapter titles in starter HTML", () => {
    expect(createChapterStarterHtml("<第一章>")).toContain("&lt;第一章&gt;");
  });
});
