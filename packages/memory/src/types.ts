export type MemoryScope = "user" | "project" | "session";

export type MemoryType =
  | "preference"
  | "canonical"
  | "character"
  | "character_state"
  | "character_knowledge"
  | "relationship"
  | "event"
  | "timeline"
  | "foreshadowing"
  | "summary"
  | "location"
  | "item"
  | "organization"
  | "style"
  | "constraint";

export interface MemoryItem {
  id: string;
  scope: MemoryScope;
  userId?: string;
  projectId?: string;
  memoryType: MemoryType;
  subtype?: string;
  title?: string;
  content: string;
  sourceType: string;
  sourceId?: string;
  importance: number;
  confidence: number;
  canonicalLevel: number;
  isLocked: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievalCandidate {
  memory: MemoryItem;
  structuredScore: number;
  keywordScore: number;
  semanticScore: number;
  relationScore: number;
  recencyScore: number;
  importanceScore: number;
  canonicalScore: number;
  finalScore?: number;
}

export interface RetrievalWeights {
  structured: number;
  canonical: number;
  relation: number;
  keyword: number;
  semantic: number;
  importance: number;
  recency: number;
}
