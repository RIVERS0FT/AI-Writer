export interface ContextBudget {
  total: number;
  systemPrompt: number;
  userInstruction: number;
  currentOutline: number;
  canonicalMemory: number;
  characterMemory: number;
  recentMemory: number;
  retrievedMemory: number;
  generationReserve: number;
}

const ratios = {
  systemPrompt: 0.1,
  userInstruction: 0.08,
  currentOutline: 0.17,
  canonicalMemory: 0.15,
  characterMemory: 0.15,
  recentMemory: 0.15,
  retrievedMemory: 0.2,
} as const;

export function createContextBudget(
  total: number,
  generationReserveRatio = 0.2,
): ContextBudget {
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Context budget must be a positive number");
  }

  const generationReserve = Math.floor(total * generationReserveRatio);
  const inputBudget = total - generationReserve;

  return {
    total,
    systemPrompt: Math.floor(inputBudget * ratios.systemPrompt),
    userInstruction: Math.floor(inputBudget * ratios.userInstruction),
    currentOutline: Math.floor(inputBudget * ratios.currentOutline),
    canonicalMemory: Math.floor(inputBudget * ratios.canonicalMemory),
    characterMemory: Math.floor(inputBudget * ratios.characterMemory),
    recentMemory: Math.floor(inputBudget * ratios.recentMemory),
    retrievedMemory: Math.floor(inputBudget * ratios.retrievedMemory),
    generationReserve,
  };
}
