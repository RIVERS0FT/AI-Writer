import {
  buildOpenAICompatiblePayload,
  parseOpenAICompatibleSseData,
  resolveChatCompletionsUrl,
  resolveModelsUrl,
  type ConnectionTestResult,
  type GenerationStreamEvent,
  type ProviderConfig,
  type ProviderRuntimeRequest,
} from "@ai-writer/providers";
import type {
  ProviderRuntimeService,
  SecureStorageService,
} from "@ai-writer/platform";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

function requestHeaders(provider: ProviderConfig, credential: string): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (credential.trim()) headers.set("Authorization", `Bearer ${credential.trim()}`);
  for (const [key, value] of Object.entries(provider.customHeaders ?? {})) {
    headers.set(key, value);
  }
  return headers;
}

async function resolveCredential(
  provider: ProviderConfig,
  secureStorage: SecureStorageService,
): Promise<string> {
  if (!provider.apiKeyRef) throw new Error("Provider 没有密钥引用");
  const credential = await secureStorage.getSecret(provider.apiKeyRef);
  if (!credential) throw new Error("密钥库中没有找到 Provider 凭据");
  return credential;
}

export function createProviderRuntime(
  secureStorage: SecureStorageService,
): ProviderRuntimeService {
  const abortControllers = new Map<string, AbortController>();

  return {
    async testConnection(provider): Promise<ConnectionTestResult> {
      const startedAt = performance.now();
      try {
        const credential = await resolveCredential(provider, secureStorage);
        const response = await tauriFetch(resolveModelsUrl(provider), {
          method: "GET",
          headers: requestHeaders(provider, credential),
        });
        return {
          ok: response.ok,
          latencyMs: Math.round(performance.now() - startedAt),
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

    async generate(request: ProviderRuntimeRequest, onEvent) {
      const controller = new AbortController();
      abortControllers.set(request.taskId, controller);
      onEvent({ event: "started", data: { taskId: request.taskId } });

      try {
        const credential = await resolveCredential(request.provider, secureStorage);
        const response = await tauriFetch(resolveChatCompletionsUrl(request.provider), {
          method: "POST",
          headers: requestHeaders(request.provider, credential),
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

        const data: Extract<GenerationStreamEvent, { event: "finished" }>["data"] = {
          taskId: request.taskId,
        };
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
