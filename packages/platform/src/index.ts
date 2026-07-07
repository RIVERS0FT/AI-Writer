import type { NovelProject } from "@ai-writer/core";
import type {
  ConnectionTestResult,
  GenerationStreamEvent,
  ModelProfile,
  ProviderConfig,
  ProviderRuntimeRequest,
} from "@ai-writer/providers";
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

export interface ProviderRepository {
  listProviders(): Promise<ProviderConfig[]>;
  saveProvider(config: ProviderConfig): Promise<ProviderConfig>;
  deleteProvider(id: string): Promise<void>;
  listModelProfiles(providerConfigId: string): Promise<ModelProfile[]>;
  saveModelProfile(profile: ModelProfile): Promise<ModelProfile>;
  deleteModelProfile(id: string): Promise<void>;
}

export interface SecureStorageService {
  unlock(password: string): Promise<void>;
  isUnlocked(): boolean;
  setSecret(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  removeSecret(key: string): Promise<void>;
}

export interface ProviderRuntimeService {
  testConnection(provider: ProviderConfig): Promise<ConnectionTestResult>;
  generate(
    request: ProviderRuntimeRequest,
    onEvent: (event: GenerationStreamEvent) => void,
  ): Promise<void>;
  cancel(taskId: string): Promise<boolean>;
}

export interface PlatformService {
  runtime: RuntimeInfo;
  projects: ProjectRepository;
  providers: ProviderRepository;
  secureStorage: SecureStorageService;
  providerRuntime: ProviderRuntimeService;
}
