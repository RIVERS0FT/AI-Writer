import type { GenerateRequest, ProviderConfig } from "./types";

export interface OpenAICompatiblePayload {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  top_p?: number;
  max_tokens?: number;
  stream: true;
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
  };

  if (request.profile.topP !== undefined) payload.top_p = request.profile.topP;
  if (request.profile.maxOutputTokens !== undefined) {
    payload.max_tokens = request.profile.maxOutputTokens;
  }

  return payload;
}

export function resolveChatCompletionsUrl(config: ProviderConfig): string {
  const base = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return `${base}/chat/completions`;
}
