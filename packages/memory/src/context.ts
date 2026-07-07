import type { MemoryItem } from "./types";

export interface ContextSection {
  title: string;
  items: MemoryItem[];
}

export interface BuiltMemoryContext {
  text: string;
  selectedIds: string[];
  estimatedTokens: number;
}

function estimateTokens(text: string): number {
  const latinWords = text.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const nonLatin = text.replace(/[\x00-\x7F]/g, "").length;
  return Math.ceil(latinWords * 1.3 + nonLatin * 0.75);
}

export function buildMemoryContext(
  sections: ContextSection[],
  tokenBudget: number,
): BuiltMemoryContext {
  const lines: string[] = [];
  const selectedIds: string[] = [];
  let used = 0;

  for (const section of sections) {
    const accepted: string[] = [];

    for (const item of section.items) {
      if (!item.isEnabled) continue;
      const line = `- ${item.title ? `${item.title}：` : ""}${item.content}`;
      const cost = estimateTokens(line);
      if (used + cost > tokenBudget) continue;
      accepted.push(line);
      selectedIds.push(item.id);
      used += cost;
    }

    if (accepted.length > 0) {
      lines.push(`[${section.title}]`, ...accepted, "");
    }
  }

  return {
    text: lines.join("\n").trim(),
    selectedIds,
    estimatedTokens: used,
  };
}
