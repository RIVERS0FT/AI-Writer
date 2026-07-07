import { describe, expect, it } from "vitest";
import { summarizeTextDiff } from "./diff";

describe("summarizeTextDiff", () => {
  it("reports inserted and removed characters around common text", () => {
    const result = summarizeTextDiff("开场旧段落结尾", "开场新内容结尾");
    expect(result.removedChars).toBe(3);
    expect(result.addedChars).toBe(3);
    expect(result.changed).toBe(true);
    expect(result.beforePreview).toBe("旧段落");
    expect(result.afterPreview).toBe("新内容");
  });

  it("reports identical text as unchanged", () => {
    expect(summarizeTextDiff("相同", "相同")).toMatchObject({
      removedChars: 0,
      addedChars: 0,
      changed: false,
    });
  });
});
