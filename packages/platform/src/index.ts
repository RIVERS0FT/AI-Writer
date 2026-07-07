import type { NovelProject } from "@ai-writer/core";
import type { CreateProjectInput } from "@ai-writer/schemas";

export interface RuntimeInfo {
  name: string;
  version: string;
  platform: "native" | "web";
  os?: string;
  arch?: string;
}

export interface ProjectRepository {
  list(): Promise<NovelProject[]>;
  create(input: CreateProjectInput): Promise<NovelProject>;
}

export interface SecureStorageService {
  setSecret(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  removeSecret(key: string): Promise<void>;
}

export interface PlatformService {
  runtime: RuntimeInfo;
  projects: ProjectRepository;
  secureStorage?: SecureStorageService;
}
