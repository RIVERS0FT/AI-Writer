import type { NovelProject } from "@ai-writer/core";
import type {
  PlatformService,
  ProjectRepository,
  ProviderRuntimeService,
  RuntimeInfo,
  SecureStorageService,
} from "@ai-writer/platform";
import {
  createProjectInputSchema,
  type CreateProjectInput,
} from "@ai-writer/schemas";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { createContentRepository } from "./content-repository";
import { createGenerationJobRepository } from "./generation-job-repository";
import { createKnowledgeRepository } from "./knowledge-repository";
import { createProviderRepository } from "./provider-repository";

interface ProjectRow {
  id: string;
  title: string;
  genre: string;
  summary: string;
  status: NovelProject["status"];
  created_at: string;
  updated_at: string;
}

function mapProject(row: ProjectRow): NovelProject {
  return {
    id: row.id,
    title: row.title,
    genre: row.genre,
    summary: row.summary,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createProjectRepository(
  database: Database,
): Promise<ProjectRepository> {
  return {
    async list() {
      const rows = await database.select<ProjectRow[]>(
        `SELECT id, title, genre, summary, status, created_at, updated_at
         FROM projects
         WHERE deleted_at IS NULL
         ORDER BY updated_at DESC`,
      );
      return rows.map(mapProject);
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

      await database.execute(
        `INSERT INTO projects
          (id, title, genre, summary, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          project.id,
          project.title,
          project.genre,
          project.summary,
          project.status,
          project.createdAt,
          project.updatedAt,
        ],
      );

      return project;
    },
  };
}

export interface NativePlatformDependencies {
  secureStorage: SecureStorageService;
  providerRuntime: ProviderRuntimeService;
}

export async function createNativePlatform(
  dependencies: NativePlatformDependencies,
): Promise<PlatformService> {
  const database = await Database.load("sqlite:ai-writer.db");
  const [runtime, projects] = await Promise.all([
    invoke<RuntimeInfo>("runtime_info"),
    createProjectRepository(database),
  ]);

  return {
    runtime,
    projects,
    contents: createContentRepository(database),
    knowledge: createKnowledgeRepository(database),
    generationJobs: createGenerationJobRepository(database),
    providers: createProviderRepository(database),
    secureStorage: dependencies.secureStorage,
    providerRuntime: dependencies.providerRuntime,
  };
}
