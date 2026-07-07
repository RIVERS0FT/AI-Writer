import { describe, expect, it } from "vitest";
import {
  createChapterStarterText,
  hashText,
  normalizeLegacyChapterText,
} from "./content";

describe("chapter content helpers", () => {
  it("creates deterministic content hashes", () => {
    expect(hashText("同一段正文")).toBe(hashText("同一段正文"));
    expect(hashText("同一段正文")).not.toBe(hashText("另一段正文"));
  });

  it("creates a plain text chapter starter", () => {
    expect(createChapterStarterText("第一章")).toBe("第一章\n\n");
  });

  it("converts legacy editor HTML into plain text", () => {
    expect(
      normalizeLegacyChapterText(
        "<h2>第一章</h2><p>正文 &amp; 线索<br />第二行</p>",
      ),
    ).toBe("第一章\n正文 & 线索\n第二行");
  });
});
