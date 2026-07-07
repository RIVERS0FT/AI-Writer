import { describe, expect, it } from "vitest";
import { estimateTokenCount, inspectContextCapacity } from "./context";

describe("context capacity", () => {
  it("reports estimated usage without inventing an application budget", () => {
    const estimatedInputTokens = estimateTokenCount("林舟走进雨夜中的旧车站。");
    const report = inspectContextCapacity({
      modelContextWindow: 8_000,
      estimatedInputTokens,
      requestedOutputTokens: 2_000,
    });

    expect(report.exceeded).toBe(false);
    expect(report.estimatedInputTokens).toBe(estimatedInputTokens);
    expect(report.remainingTokens).toBe(8_000 - estimatedInputTokens - 2_000);
  });

  it("only reports overflow against the model context window", () => {
    expect(
      inspectContextCapacity({
        modelContextWindow: 4_000,
        estimatedInputTokens: 3_500,
        requestedOutputTokens: 1_000,
      }),
    ).toMatchObject({
      estimatedTotalTokens: 4_500,
      exceeded: true,
      remainingTokens: -500,
    });
  });

  it("does not mark usage as exceeded when the model window is unknown", () => {
    expect(
      inspectContextCapacity({
        estimatedInputTokens: 100_000,
        requestedOutputTokens: 10_000,
      }).exceeded,
    ).toBe(false);
  });
});
