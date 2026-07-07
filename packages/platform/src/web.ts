import type { NovelProject } from "@ai-writer/core";
import {
  buildOpenAICompatiblePayload,
  parseOpenAICompatibleSseData,
  resolveChatCompletionsUrl,
  resolveModelsUrl,
  type ConnectionTestResult,
  type GenerationStreamEvent,
  type ModelProfile,
  type ProviderConfig,
  type ProviderRuntimeRequest,
} from "@ai-writer/providers";
import {
  createProjectInputSchema,
  modelProfileSchema,
  providerConfigSchema,
  type CreateProjectInput,
} from "@ai-writer/schemas";
import type {
  PlatformService,
  ProjectRepository,
  ProviderRepository,
  ProviderRuntimeService,
  SecureStorageService,
} from "./index";
import { createWebContentRepository } from "./web-content";
import { createWebGenerationJobRepository } from "./web-generation-jobs";
import { createWebKnowledgeRepository } from "./web-knowledge";

const projectsStorageKey = "ai-writer.projects.v1";
const providersStorageKey = "ai-writer.providers.v1";
const profilesStorageKey = "ai-writer.model-profiles.v1";
const secretsStoragePrefix = "ai-writer.secret.";

function readJsonArray<T>(key: string): T[] {
  const raw = globalThis.localStorage?.getItem(key);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, values: T[]): void {
  globalThis.localStorage?.setItem(key, JSON.stringify(values));
}

const projectRepository: ProjectRepository = {
  async list() {
    return readJsonArray<NovelProject>(projectsStorageKey).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
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
    writeJsonArray(projectsStorageKey, [
      project,
      ...readJsonArray<NovelProject>(projectsStorageKey),
    ]);
    return project;
  },
};

const providerRepository: ProviderRepository = {
  async listProviders() {
    return readJsonArray<ProviderConfig>(providersStorageKey);
  },
  async saveProvider(config) {
    const parsed = providerConfigSchema.parse(config);
    const providers = readJsonArray<ProviderConfig>(providersStorageKey);
    writeJsonArray(providersStorageKey, [
      parsed,
      ...providers.filter((item) => item.id !== parsed.id),
    ]);
    return parsed;
  },
  async deleteProvider(id) {
    writeJsonArray(
      providersStorageKey,
      readJsonArray<ProviderConfig>(providersStorageKey).filter(
        (provider) => provider.id !== id,
      ),
    );
    writeJsonArray(
      profilesStorageKey,
      readJsonArray<ModelProfile>(profilesStorageKey).filter(
        (profile) => profile.providerConfigId !== id,
      ),
    );
  },
  async listModelProfiles(providerConfigId) {
    return readJsonArray<ModelProfile>(profilesStorageKey).filter(
      (profile) => profile.providerConfigId === providerConfigId,
    );
  },
  async saveModelProfile(profile) {
    const parsed = modelProfileSchema.parse(profile);
    const profiles = readJsonArray<ModelProfile>(profilesStorageKey);
    writeJsonArray(profilesStorageKey, [
      parsed,
      ...profiles.filter((item) => item.id !== parsed.id),
    ]);
    return parsed;
  },
  async deleteModelProfile(id) {
    writeJsonArray(
      profilesStorageKey,
      readJsonArray<ModelProfile>(profilesStorageKey).filter(
        (profile) => profile.id !== id,
      ),
    );
  },
};

let webVaultUnlocked = false;

const secureStorage: SecureStorageService = {
  async unlock(password) {
    if (!password.trim()) throw new Error("密钥库密码不能为空");
    webVaultUnlocked = true;
  },
  isUnlocked() {
    return webVaultUnlocked;
  },
  async setSecret(key, value) {
    if (!webVaultUnlocked) throw new Error("密钥库尚未解锁");
    globalThis.sessionStorage?.setItem(`${secretsStoragePrefix}${key}`, value);
  },
  async getSecret(key) {
    if (!webVaultUnlocked) throw new Error("密钥库尚未解锁");
    return globalThis.sessionStorage?.getItem(`${secretsStoragePrefix}${key}`) ?? null;
  },
  async removeSecret(key) {
    if (!webVaultUnlocked) throw new Error("密钥库尚未解锁");
    globalThis.sessionStorage?.removeItem(`${secretsStoragePrefix}${key}`);
  },
};

function headersFor(provider: ProviderConfig, credential: string): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (credential.trim()) {
    headers.set("Authorization", `Bearer ${credential.trim()}`);
  }
  for (const [key, value] of Object.entries(provider.customHeaders ?? {})) {
    headers.set(key, value);
  }
  return headers;
}

function createProviderRuntime(
  secretStore: SecureStorageService,
): ProviderRuntimeService {
  const abortControllers = new Map<string, AbortController>();

  async function credentialFor(provider: ProviderConfig): Promise<string> {
    if (!provider.apiKeyRef) throw new Error("Provider 没有密钥引用");
    const credential = await secretStore.getSecret(provider.apiKeyRef);
    if (!credential) throw new Error("会话密钥库中没有找到 Provider 凭据");
    return credential;
  }

  return {
    async testConnection(provider): Promise<ConnectionTestResult> {
      const startedAt = performance.now();
      try {
        const credential = await credentialFor(provider);
        const response = await fetch(resolveModelsUrl(provider), {
          method: "GET",
          headers: headersFor(provider, credential),
        });
        const latencyMs = Math.round(performance.now() - startedAt);
        return {
          ok: response.ok,
          latencyMs,
          message: response.ok
            ? `连接成功（HTTP ${response.status}）`
            : `连接失败（HTTP ${response.status}）`,
        };
      } catch (error) {
        return {
          ok: false,
          latencyMs: Math.round(performance.now() - startedAt),
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async generate(
      request: ProviderRuntimeRequest,
      onEvent: (event: GenerationStreamEvent) => void,
    ) {
      const controller = new AbortController();
      abortControllers.set(request.taskId, controller);
      onEvent({ event: "started", data: { taskId: request.taskId } });
      try {
        const credential = await credentialFor(request.provider);
        const response = await fetch(resolveChatCompletionsUrl(request.provider), {
          method: "POST",
          headers: headersFor(request.provider, credential),
          body: JSON.stringify(buildOpenAICompatiblePayload(request)),
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 800);
          throw new Error(`HTTP ${response.status}: ${detail || response.statusText}`);
        }
        if (!response.body) throw new Error("模型服务没有返回流式响应");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex >= 0) {
            const rawLine = buffer.slice(0, newlineIndex).replace(/\r$/, "");
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf("\n");
            if (!rawLine.startsWith("data:")) continue;
            const parsed = parseOpenAICompatibleSseData(rawLine.slice(5));
            if (!parsed) continue;
            if (parsed.inputTokens !== undefined) inputTokens = parsed.inputTokens;
            if (parsed.outputTokens !== undefined) outputTokens = parsed.outputTokens;
            if (parsed.text) {
              onEvent({
                event: "chunk",
                data: { taskId: request.taskId, text: parsed.text },
              });
            }
          }
          if (done) break;
        }

        const data: Extract<
          GenerationStreamEvent,
          { event: "finished" }
        >["data"] = { taskId: request.taskId };
        if (inputTokens !== undefined) data.inputTokens = inputTokens;
        if (outputTokens !== undefined) data.outputTokens = outputTokens;
        onEvent({ event: "finished", data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onEvent({ event: "error", data: { taskId: request.taskId, message } });
        throw error;
      } finally {
        abortControllers.delete(request.taskId);
      }
    },

    async cancel(taskId) {
      const controller = abortControllers.get(taskId);
      if (!controller) return false;
      controller.abort();
      return true;
    },
  };
}

export function createWebPlatform(): PlatformService {
  return {
    runtime: {
      name: "AI-Writer Web",
      version: "0.5.0",
      platform: "web",
      os: navigator.platform || "browser",
    },
    projects: projectRepository,
    contents: createWebContentRepository(),
    knowledge: createWebKnowledgeRepository(),
    generationJobs: createWebGenerationJobRepository(),
    providers: providerRepository,
    secureStorage,
    providerRuntime: createProviderRuntime(secureStorage),
  };
}
