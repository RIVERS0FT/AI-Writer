export type ProjectStatus = "planning" | "writing" | "completed" | "archived";
export type ChapterStatus = "planned" | "drafting" | "completed";

export interface NovelProject {
  id: string;
  title: string;
  genre: string;
  summary: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Volume {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  volumeId?: string | undefined;
  title: string;
  order: number;
  status: ChapterStatus;
  contentJson: Record<string, unknown>;
  contentMarkdown: string;
  plainText: string;
  summary?: string | undefined;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterVersion {
  id: string;
  chapterId: string;
  version: number;
  contentJson: Record<string, unknown>;
  contentMarkdown: string;
  plainText: string;
  changeType: "manual" | "autosave" | "ai_generation" | "recovery";
  changeReason?: string | undefined;
  createdAt: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  profile: string;
  motivation: string;
  currentState: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorldEntry {
  id: string;
  projectId: string;
  entryType: string;
  title: string;
  content: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OutlineNodeType = "story" | "volume" | "chapter" | "scene" | "note";

export interface OutlineNode {
  id: string;
  projectId: string;
  parentId?: string | undefined;
  nodeType: OutlineNodeType;
  title: string;
  content: string;
  order: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GenerationStatus =
  | "queued"
  | "building_context"
  | "planning"
  | "generating"
  | "reviewing"
  | "rewriting"
  | "saving"
  | "completed"
  | "failed"
  | "cancelled";

export type GenerationTaskType =
  | "chapter_continuation"
  | "scene_generation"
  | "rewrite"
  | "expand"
  | "consistency_check";

export interface GenerationJob {
  id: string;
  projectId: string;
  chapterId?: string | undefined;
  providerConfigId?: string | undefined;
  modelProfileId?: string | undefined;
  taskType: GenerationTaskType;
  status: GenerationStatus;
  progress: number;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
}

export interface GenerationOutput {
  id: string;
  jobId: string;
  outputType: "draft" | "plan" | "review";
  content: string;
  createdAt: string;
}
