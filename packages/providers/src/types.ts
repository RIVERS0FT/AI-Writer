export interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
  baseUrl?: string | undefined;
  apiKeyRef?: string | undefined;
  customHeaders?: Record<string, string> | undefined;
}

export interface ModelProfile {
  id: string;
  providerConfigId: string;
  name: string;
  model: string;
  temperature: number;
  topP?: number | undefined;
  maxOutputTokens?: number | undefined;
  contextWindow?: number | undefined;
  timeoutMs: number;
  maxRetries: number;
}

export interface GenerateRequest {
  taskId: string;
  systemPrompt: string;
  userPrompt: string;
  profile: ModelProfile;
}

export interface ProviderRuntimeRequest extends GenerateRequest {
  provider: ProviderConfig;
}

export interface GenerationChunk {
  taskId: string;
  text: string;
  done: boolean;
}

export type GenerationStreamEvent =
  | { event: "started"; data: { taskId: string } }
  | { event: "chunk"; data: { taskId: string; text: string } }
  | {
      event: "finished";
      data: {
        taskId: string;
        inputTokens?: number;
        outputTokens?: number;
      };
    }
  | { event: "error"; data: { taskId: string; message: string } };

export interface GenerateResult {
  taskId: string;
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export interface GenerateCallbacks {
  onChunk(chunk: GenerationChunk): void;
}

export interface ModelProvider {
  testConnection(config: ProviderConfig): Promise<ConnectionTestResult>;
  generate(request: GenerateRequest, callbacks: GenerateCallbacks): Promise<GenerateResult>;
  abort(taskId: string): Promise<void>;
}
