import type { NovelProject } from "@ai-writer/core";
import { createProjectInputSchema, type CreateProjectInput } from "@ai-writer/schemas";
import type { PlatformService, ProjectRepository } from "./index";

const storageKey = "ai-writer.projects.v1";

function readProjects(): NovelProject[] {
  const raw = globalThis.localStorage?.getItem(storageKey);
  if (!raw) return [];

  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as NovelProject[]) : [];
  } catch {
    return [];
  }
}

function writeProjects(projects: NovelProject[]): void {
  globalThis.localStorage?.setItem(storageKey, JSON.stringify(projects));
}

const repository: ProjectRepository = {
  async list() {
    return readProjects().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async create(input: CreateProjectInput) {
    const parsed = createProjectInputSchema.parse(input);
    const now = new Date().toISOString();
    const project: NovelProject = {
      id: crypto.randomUUID(),
      title: parsed.title,
      genre: parsed.genre,
      summary: parsed.summary,
      status: "planning",
      createdAt: now,
      updatedAt: now,
    };

    writeProjects([project, ...readProjects()]);
    return project;
  },
};

export function createWebPlatform(): PlatformService {
  return {
    runtime: {
      name: "AI-Writer Web",
      version: "0.1.0",
      platform: "web",
      os: navigator.platform || "browser",
    },
    projects: repository,
  };
}
