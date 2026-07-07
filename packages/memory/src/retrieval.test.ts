import { describe, expect, it } from "vitest";
import { rankCandidates } from "./retrieval";
import type { RetrievalCandidate } from "./types";

function candidate(id: string, canonicalScore: number): RetrievalCandidate {
  return {
    memory: {
      id,
      scope: "project",
      projectId: "project-1",
      memoryType: "canonical",
      content: id,
      sourceType: "project_setting",
      importance: 1,
      confidence: 1,
      canonicalLevel: 1,
      isLocked: true,
      isEnabled: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    structuredScore: 0.8,
    keywordScore: 0.5,
    semanticScore: 0.4,
    relationScore: 0.6,
    recencyScore: 0.2,
    importanceScore: 1,
    canonicalScore,
  };
}

describe("hybrid retrieval", () => {
  it("ranks stronger canonical memories first", () => {
    const ranked = rankCandidates([candidate("weak", 0.1), candidate("strong", 1)]);
    expect(ranked[0]?.memory.id).toBe("strong");
  });

  it("deduplicates the same memory id", () => {
    const ranked = rankCandidates([candidate("same", 0.1), candidate("same", 1)]);
    expect(ranked).toHaveLength(1);
  });
});
