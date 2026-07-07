export interface ContextCapacityInput {
  modelContextWindow?: number | undefined;
  estimatedInputTokens?: number | undefined;
  requestedOutputTokens?: number | undefined;
}

export interface ContextCapacityReport {
  modelContextWindow?: number | undefined;
  estimatedInputTokens?: number | undefined;
  requestedOutputTokens?: number | undefined;
  estimatedTotalTokens?: number | undefined;
  exceeded: boolean;
  remainingTokens?: number | undefined;
}

export function estimateTokenCount(text: string): number {
  const latinWords = text.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const nonLatinCharacters = text.replace(/[\x00-\x7F]/g, "").length;
  const punctuation = text.match(/[^\sA-Za-z0-9_\x00-\x7F]/g)?.length ?? 0;
  return Math.max(
    0,
    Math.ceil(latinWords * 1.3 + nonLatinCharacters * 0.75 + punctuation * 0.25),
  );
}

export function inspectContextCapacity(
  input: ContextCapacityInput,
): ContextCapacityReport {
  const estimatedTotalTokens =
    input.estimatedInputTokens !== undefined ||
    input.requestedOutputTokens !== undefined
      ? (input.estimatedInputTokens ?? 0) + (input.requestedOutputTokens ?? 0)
      : undefined;

  if (input.modelContextWindow === undefined || estimatedTotalTokens === undefined) {
    return {
      ...(input.modelContextWindow !== undefined
        ? { modelContextWindow: input.modelContextWindow }
        : {}),
      ...(input.estimatedInputTokens !== undefined
        ? { estimatedInputTokens: input.estimatedInputTokens }
        : {}),
      ...(input.requestedOutputTokens !== undefined
        ? { requestedOutputTokens: input.requestedOutputTokens }
        : {}),
      ...(estimatedTotalTokens !== undefined ? { estimatedTotalTokens } : {}),
      exceeded: false,
    };
  }

  return {
    modelContextWindow: input.modelContextWindow,
    ...(input.estimatedInputTokens !== undefined
      ? { estimatedInputTokens: input.estimatedInputTokens }
      : {}),
    ...(input.requestedOutputTokens !== undefined
      ? { requestedOutputTokens: input.requestedOutputTokens }
      : {}),
    estimatedTotalTokens,
    exceeded: estimatedTotalTokens > input.modelContextWindow,
    remainingTokens: input.modelContextWindow - estimatedTotalTokens,
  };
}
