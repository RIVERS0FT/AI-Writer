import type { RetrievalCandidate, RetrievalWeights } from "./types";

export const chapterGenerationWeights: RetrievalWeights = {
  structured: 0.25,
  canonical: 0.2,
  relation: 0.15,
  keyword: 0.15,
  semantic: 0.15,
  importance: 0.07,
  recency: 0.03,
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function scoreCandidate(
  candidate: RetrievalCandidate,
  weights: RetrievalWeights = chapterGenerationWeights,
): RetrievalCandidate & { finalScore: number } {
  const finalScore =
    clampScore(candidate.structuredScore) * weights.structured +
    clampScore(candidate.canonicalScore) * weights.canonical +
    clampScore(candidate.relationScore) * weights.relation +
    clampScore(candidate.keywordScore) * weights.keyword +
    clampScore(candidate.semanticScore) * weights.semantic +
    clampScore(candidate.importanceScore) * weights.importance +
    clampScore(candidate.recencyScore) * weights.recency;

  return { ...candidate, finalScore };
}

export function rankCandidates(
  candidates: RetrievalCandidate[],
  weights: RetrievalWeights = chapterGenerationWeights,
): Array<RetrievalCandidate & { finalScore: number }> {
  const unique = new Map<string, RetrievalCandidate>();

  for (const candidate of candidates) {
    const existing = unique.get(candidate.memory.id);
    if (!existing || scoreCandidate(candidate, weights).finalScore > scoreCandidate(existing, weights).finalScore) {
      unique.set(candidate.memory.id, candidate);
    }
  }

  return [...unique.values()]
    .map((candidate) => scoreCandidate(candidate, weights))
    .sort((a, b) => b.finalScore - a.finalScore);
}
