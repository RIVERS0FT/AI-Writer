import type { GenerateRequest, ProviderConfig } from "./types";

export interface OpenAICompatiblePayload {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  top_p?: number;
  max_tokens?: number;
  stream: true;
  stream_options: { include_usage: true };
}

export interface ParsedOpenAIStreamData {
  text: string;
  done: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export function buildOpenAICompatiblePayload(
  request: GenerateRequest,
): OpenAICompatiblePayload {
  const payload: OpenAICompatiblePayload = {
    model: request.profile.model,
    messages: [
      { role: "system", content: request.systemPrompt },
      { role: "user", content: request.userPrompt },
    ],
    temperature: request.profile.temperature,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (request.profile.topP !== undefined) payload.top_p = request.profile.topP;
  if (request.profile.maxOutputTokens !== undefined) {
    payload.max_tokens = request.profile.maxOutputTokens;
  }

  return payload;
}

export function resolveOpenAIBaseUrl(config: ProviderConfig): string {
  return (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

export function resolveChatCompletionsUrl(config: ProviderConfig): string {
  return `${resolveOpenAIBaseUrl(config)}/chat/completions`;
}

export function resolveModelsUrl(config: ProviderConfig): string {
  return `${resolveOpenAIBaseUrl(config)}/models`;
}

export function parseOpenAICompatibleSseData(
  data: string,
): ParsedOpenAIStreamData | null {
  const trimmed = data.trim();
  if (!trimmed) return null;
  if (trimmed === "[DONE]") return { text: "", done: true };

  const parsed: unknown = JSON.parse(trimmed);
  if (!isRecord(parsed)) return null;

  const choices = parsed.choices;
  const firstChoice = Array.isArray(choices) ? choices[0] : undefined;
  const choice = isRecord(firstChoice) ? firstChoice : undefined;
  const delta = choice && isRecord(choice.delta) ? choice.delta : undefined;
  const deltaContent = delta?.content;
  const fallbackText = choice?.text;
  const text =
    typeof deltaContent === "string"
      ? deltaContent
      : typeof fallbackText === "string"
        ? fallbackText
        : "";

  const usage = isRecord(parsed.usage) ? parsed.usage : undefined;
  const inputTokens = numberOrUndefined(usage?.prompt_tokens);
  const outputTokens = numberOrUndefined(usage?.completion_tokens);
  const finishReason = choice?.finish_reason;

  const result: ParsedOpenAIStreamData = {
    text,
    done: finishReason !== null && finishReason !== undefined,
  };

  if (inputTokens !== undefined) result.inputTokens = inputTokens;
  if (outputTokens !== undefined) result.outputTokens = outputTokens;
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
