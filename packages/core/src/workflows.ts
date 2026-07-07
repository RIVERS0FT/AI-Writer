import type { GenerationStatus } from "./entities";

const transitions: Record<GenerationStatus, readonly GenerationStatus[]> = {
  queued: ["building_context", "cancelled", "failed"],
  building_context: ["planning", "generating", "cancelled", "failed"],
  planning: ["generating", "cancelled", "failed"],
  generating: ["reviewing", "saving", "cancelled", "failed"],
  reviewing: ["rewriting", "saving", "cancelled", "failed"],
  rewriting: ["reviewing", "saving", "cancelled", "failed"],
  saving: ["completed", "failed"],
  completed: [],
  failed: ["queued"],
  cancelled: ["queued"],
};

export function canTransitionGeneration(
  from: GenerationStatus,
  to: GenerationStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertGenerationTransition(
  from: GenerationStatus,
  to: GenerationStatus,
): void {
  if (!canTransitionGeneration(from, to)) {
    throw new Error(`Invalid generation transition: ${from} -> ${to}`);
  }
}
