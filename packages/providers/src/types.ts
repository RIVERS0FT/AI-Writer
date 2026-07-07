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

export type ProviderWritingTaskType =
  | "chapter_generation"
  | "chapter_continuation"
  | "scene_generation"
  | "rewrite"
  | "expand"
  | "shorten"
  | "consistency_check"
  | "consistency_fix";

export type ProviderWritingStepType =
  | "context_build"
  | "chapter_plan"
  | "scene_plan"
  | "draft"
  | "continuity_review"
  | "character_review"
  | "style_review"
  | "targeted_rewrite"
  | "polish"
  | "memory_extraction"
  | "save";

export interface ProviderWritingMetadata {
  projectId: string;
  chapterId?: string | undefined;
  taskType: ProviderWritingTaskType;
  stepId?: string | undefined;
  stepType: ProviderWritingStepType;
  promptId?: string | undefined;
  promptVersion?: string | undefined;
}

export interface ProviderRuntimeRequest extends GenerateRequest {
  provider: ProviderConfig;
  writing?: ProviderWritingMetadata | undefined;
}

export interface ProviderUsage {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
  cachedInputTokens?: number | undefined;
  reasoningTokens?: number | undefined;
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
        usage?: ProviderUsage;
      };
    }
  | { event: "error"; data: { taskId: string; message: string } };

export interface GenerateResult {
  taskId: string;
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  usage?: ProviderUsage;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export interface ProviderRuntimeService {
  testConnection(provider: ProviderConfig): Promise<ConnectionTestResult>;
  generate(
    request: ProviderRuntimeRequest,
    onEvent: (event: GenerationStreamEvent) => void,
  ): Promise<void>;
  cancel(taskId: string): Promise<boolean>;
}

export interface GenerateCallbacks {
  onChunk(chunk: GenerationChunk): void;
}

export interface ModelProvider {
  testConnection(config: ProviderConfig): Promise<ConnectionTestResult>;
  generate(request: GenerateRequest, callbacks: GenerateCallbacks): Promise<GenerateResult>;
  abort(taskId: string): Promise<void>;
}
