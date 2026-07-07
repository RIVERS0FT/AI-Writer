import { describe, expect, it } from "vitest";
import {
  buildOpenAICompatiblePayload,
  parseOpenAICompatibleSseData,
  resolveChatCompletionsUrl,
} from "./openai-compatible";
import type { GenerateRequest, ProviderConfig } from "./types";

const provider: ProviderConfig = {
  id: "provider-1",
  name: "Test",
  providerType: "openai-compatible",
  baseUrl: "https://example.com/v1/",
};

const request: GenerateRequest = {
  taskId: "task-1",
  systemPrompt: "system",
  userPrompt: "user",
  profile: {
    id: "profile-1",
    providerConfigId: provider.id,
    name: "Writer",
    model: "example-model",
    temperature: 0.8,
    maxOutputTokens: 1000,
    timeoutMs: 120000,
    maxRetries: 2,
  },
};

describe("OpenAI compatible helpers", () => {
  it("builds a streaming payload", () => {
    const payload = buildOpenAICompatiblePayload(request);
    expect(payload.model).toBe("example-model");
    expect(payload.stream).toBe(true);
    expect(payload.stream_options.include_usage).toBe(true);
  });

  it("normalizes the chat completions URL", () => {
    expect(resolveChatCompletionsUrl(provider)).toBe(
      "https://example.com/v1/chat/completions",
    );
  });

  it("parses streamed content and usage", () => {
    expect(
      parseOpenAICompatibleSseData(
        JSON.stringify({
          choices: [{ delta: { content: "你好" }, finish_reason: null }],
          usage: { prompt_tokens: 10, completion_tokens: 2 },
        }),
      ),
    ).toEqual({ text: "你好", done: false, inputTokens: 10, outputTokens: 2 });
  });

  it("recognizes the DONE marker", () => {
    expect(parseOpenAICompatibleSseData("[DONE]")).toEqual({
      text: "",
      done: true,
    });
  });
});
