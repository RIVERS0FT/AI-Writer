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

export interface Chapter {
  id: string;
  projectId: string;
  volumeId?: string;
  title: string;
  order: number;
  status: ChapterStatus;
  contentJson: Record<string, unknown>;
  contentMarkdown: string;
  plainText: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  profile: string;
  motivation: string;
  currentState: string;
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

export interface GenerationJob {
  id: string;
  projectId: string;
  chapterId?: string;
  status: GenerationStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  errorCode?: string;
  errorMessage?: string;
}
