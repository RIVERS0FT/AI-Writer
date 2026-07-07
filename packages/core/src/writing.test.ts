import { describe, expect, it } from "vitest";
import {
  defaultWritingPipelineOptions,
  summarizeTokenUsage,
  type TokenUsageRecord,
} from "./writing";

function usage(
  overrides: Partial<TokenUsageRecord> = {},
): TokenUsageRecord {
  return {
    id: crypto.randomUUID(),
    jobId: "job-1",
    stepId: "step-1",
    projectId: "project-1",
    providerConfigId: "provider-1",
    modelProfileId: "profile-1",
    model: "test-model",
    taskType: "chapter_continuation",
    stepType: "draft",
    attempt: 1,
    status: "completed",
    source: "provider",
    startedAt: "2026-07-07T00:00:00.000Z",
    completedAt: "2026-07-07T00:00:01.000Z",
    ...overrides,
  };
}

describe("writing pipeline defaults", () => {
  it("does not disable stages based on token usage", () => {
    expect(defaultWritingPipelineOptions).toEqual({
      enablePlanning: true,
      enableContinuityReview: true,
      enableCharacterReview: true,
      enableStyleReview: true,
      enableTargetedRewrite: true,
      enableMemoryExtraction: true,
    });
  });
});

describe("summarizeTokenUsage", () => {
  it("aggregates known usage and retry attempts", () => {
    const summary = summarizeTokenUsage([
      usage({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
      usage({
        id: "request-2",
        attempt: 2,
        inputTokens: 120,
        outputTokens: 60,
        source: "estimated",
      }),
      usage({
        id: "request-3",
        attempt: 3,
        status: "failed",
        source: "unknown",
      }),
    ]);

    expect(summary).toEqual({
      requestCount: 3,
      retryCount: 2,
      knownInputTokens: 220,
      knownOutputTokens: 110,
      knownTotalTokens: 330,
      unknownRequestCount: 1,
      providerRequestCount: 1,
      estimatedRequestCount: 1,
    });
  });

  it("keeps unknown usage distinct from a real zero", () => {
    const summary = summarizeTokenUsage([
      usage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
      usage({ id: "unknown", source: "unknown" }),
    ]);

    expect(summary.knownTotalTokens).toBe(0);
    expect(summary.unknownRequestCount).toBe(1);
  });
});
