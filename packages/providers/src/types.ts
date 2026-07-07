export interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
  baseUrl?: string;
  apiKeyRef?: string;
  customHeaders?: Record<string, string>;
}

export interface ModelProfile {
  providerConfigId: string;
  model: string;
  temperature: number;
  topP?: number;
  maxOutputTokens?: number;
  contextWindow?: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface GenerateRequest {
  taskId: string;
  systemPrompt: string;
  userPrompt: string;
  profile: ModelProfile;
}

export interface GenerationChunk {
  taskId: string;
  text: string;
  done: boolean;
}

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
