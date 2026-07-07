import {
  defaultWritingPipelineOptions,
  type GenerationJob,
  type WritingStep,
} from "@ai-writer/core";
import type { GenerationStreamEvent } from "@ai-writer/providers";
import { describe, expect, it } from "vitest";
import type { PlatformService } from "./index";
import { createWritingOrchestratorPlatform } from "./writing-orchestrator";

function createPlatform(responses: string[]): {
  platform: PlatformService;
  steps: WritingStep[];
  calls: string[];
} {
  const steps: WritingStep[] = [];
  const calls: string[] = [];
  const jobs = new Map<string, GenerationJob>();

  const platform = {
    runtime: { name: "test", version: "1", platform: "web" },
    projects: {
      async list() {
        return [
          {
            id: "project-1",
            title: "测试小说",
            genre: "悬疑",
            summary: "一座封闭城市中的失踪案。",
            status: "writing" as const,
            createdAt: "2026-07-07T00:00:00.000Z",
            updatedAt: "2026-07-07T00:00:00.000Z",
          },
        ];
      },
      async create() {
        throw new Error("not used");
      },
    },
    contents: {
      async listVolumes() {
        return [];
      },
      async createVolume() {
        throw new Error("not used");
      },
      async updateVolume() {
        throw new Error("not used");
      },
      async deleteVolume() {},
      async restoreVolume() {
        throw new Error("not used");
      },
      async listChapters() {
        return [
          {
            id: "chapter-1",
            projectId: "project-1",
            title: "雨夜来客",
            order: 0,
            status: "drafting" as const,
            plainText: "雨声敲打窗户。",
            contentHash: "hash",
            createdAt: "2026-07-07T00:00:00.000Z",
            updatedAt: "2026-07-07T00:00:00.000Z",
          },
        ];
      },
      async getChapter() {
        return {
          id: "chapter-1",
          projectId: "project-1",
          title: "雨夜来客",
          order: 0,
          status: "drafting" as const,
          plainText: "雨声敲打窗户。",
          contentHash: "hash",
          createdAt: "2026-07-07T00:00:00.000Z",
          updatedAt: "2026-07-07T00:00:00.000Z",
        };
      },
      async createChapter() {
        throw new Error("not used");
      },
      async updateChapter() {
        throw new Error("not used");
      },
      async deleteChapter() {},
      async restoreChapter() {
        throw new Error("not used");
      },
      async saveChapterContent() {
        throw new Error("not used");
      },
      async createChapterVersion() {
        throw new Error("not used");
      },
      async listChapterVersions() {
        return [];
      },
      async restoreChapterVersion() {
        throw new Error("not used");
      },
    },
    knowledge: {
      async listCharacters() {
        return [
          {
            id: "character-1",
            projectId: "project-1",
            name: "林舟",
            aliases: [],
            profile: "谨慎的调查员",
            motivation: "找到失踪者",
            currentState: "尚不知道凶手身份",
            isLocked: true,
            createdAt: "2026-07-07T00:00:00.000Z",
            updatedAt: "2026-07-07T00:00:00.000Z",
          },
        ];
      },
      async createCharacter() {
        throw new Error("not used");
      },
      async updateCharacter() {
        throw new Error("not used");
      },
      async deleteCharacter() {},
      async listWorldEntries() {
        return [];
      },
      async createWorldEntry() {
        throw new Error("not used");
      },
      async updateWorldEntry() {
        throw new Error("not used");
      },
      async deleteWorldEntry() {},
      async listOutlineNodes() {
        return [];
      },
      async createOutlineNode() {
        throw new Error("not used");
      },
      async updateOutlineNode() {
        throw new Error("not used");
      },
      async deleteOutlineNode() {},
    },
    generationJobs: {
      async listRecent() {
        return [...jobs.values()];
      },
      async create(input: Parameters<PlatformService["generationJobs"]["create"]>[0]) {
        const now = "2026-07-07T00:00:00.000Z";
        const job: GenerationJob = {
          id: input.id,
          projectId: input.projectId,
          chapterId: input.chapterId,
          providerConfigId: input.providerConfigId,
          modelProfileId: input.modelProfileId,
          taskType: input.taskType,
          status: "queued",
          progress: 0,
          instruction: input.instruction ?? "让来客带来一条危险线索",
          pipelineVersion: input.pipelineVersion ?? "1",
          promptSetVersion: input.promptSetVersion ?? "1",
          options: input.options ?? defaultWritingPipelineOptions,
          retryCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        jobs.set(job.id, job);
        return job;
      },
      async update(id: string, input: Parameters<PlatformService["generationJobs"]["update"]>[1]) {
        const current = jobs.get(id);
        if (!current) throw new Error("missing job");
        const updated = { ...current, ...input, updatedAt: current.updatedAt } as GenerationJob;
        jobs.set(id, updated);
        return updated;
      },
      async replaceOutput() {
        throw new Error("not used");
      },
      async getOutput() {
        return undefined;
      },
      async markInterrupted() {
        return 0;
      },
    },
    writing: {
      async listSteps(jobId: string) {
        return steps.filter((step) => step.jobId === jobId);
      },
      async createStep(input: Parameters<PlatformService["writing"]["createStep"]>[0]) {
        const step: WritingStep = {
          id: input.id,
          jobId: input.jobId,
          stepType: input.stepType,
          order: input.order,
          status: input.status ?? "queued",
          attemptCount: 0,
          promptId: input.promptId,
          promptVersion: input.promptVersion,
          input: input.input,
        };
        steps.push(step);
        return step;
      },
      async updateStep(id: string, input: Parameters<PlatformService["writing"]["updateStep"]>[1]) {
        const index = steps.findIndex((step) => step.id === id);
        if (index < 0) throw new Error("missing step");
        const current = steps[index]!;
        const updated = { ...current, ...input } as WritingStep;
        steps[index] = updated;
        return updated;
      },
    },
    usage: {
      async recordRequest(input) {
        return input;
      },
      async listForJob() {
        return [];
      },
      async summarizeTask() {
        return {
          requestCount: 0,
          retryCount: 0,
          knownInputTokens: 0,
          knownOutputTokens: 0,
          knownTotalTokens: 0,
          unknownRequestCount: 0,
          providerRequestCount: 0,
          estimatedRequestCount: 0,
        };
      },
      async summarizeChapter() {
        return this.summarizeTask("");
      },
      async summarizeProject() {
        return this.summarizeTask("");
      },
      async summarizeModel() {
        return this.summarizeTask("");
      },
    },
    providers: {
      async listProviders() {
        return [];
      },
      async saveProvider(value) {
        return value;
      },
      async deleteProvider() {},
      async listModelProfiles() {
        return [];
      },
      async saveModelProfile(value) {
        return value;
      },
      async deleteModelProfile() {},
    },
    secureStorage: {
      async unlock() {},
      isUnlocked() {
        return true;
      },
      async setSecret() {},
      async getSecret() {
        return "secret";
      },
      async removeSecret() {},
    },
    providerRuntime: {
      async testConnection() {
        return { ok: true, latencyMs: 1, message: "ok" };
      },
      async generate(request, onEvent) {
        calls.push(request.writing?.stepType ?? "unknown");
        const response = responses.shift();
        if (response === undefined) throw new Error("missing response");
        onEvent({ event: "started", data: { taskId: request.taskId } });
        onEvent({ event: "chunk", data: { taskId: request.taskId, text: response } });
        onEvent({ event: "finished", data: { taskId: request.taskId } });
      },
      async cancel() {
        return true;
      },
    },
  } as unknown as PlatformService;

  return { platform, steps, calls };
}

async function run(
  platform: PlatformService,
): Promise<{ events: GenerationStreamEvent[]; jobId: string }> {
  const wrapped = createWritingOrchestratorPlatform(platform);
  const jobId = "job-1";
  await wrapped.generationJobs.create({
    id: jobId,
    projectId: "project-1",
    chapterId: "chapter-1",
    providerConfigId: "provider-1",
    modelProfileId: "profile-1",
    taskType: "chapter_continuation",
    instruction: "让来客带来一条危险线索",
  });

  const events: GenerationStreamEvent[] = [];
  await wrapped.providerRuntime.generate(
    {
      taskId: jobId,
      provider: {
        id: "provider-1",
        name: "Provider",
        providerType: "openai-compatible",
      },
      profile: {
        id: "profile-1",
        providerConfigId: "provider-1",
        name: "Model",
        model: "model-1",
        temperature: 0.8,
        timeoutMs: 60_000,
        maxRetries: 0,
      },
      systemPrompt: "legacy system prompt",
      userPrompt: "legacy user prompt",
    },
    (event) => events.push(event),
  );
  return { events, jobId };
}

describe("writing orchestrator", () => {
  it("plans, drafts and reviews before returning final text", async () => {
    const { platform, calls } = createPlatform([
      '{"chapterGoal":"推进调查","scenes":[]}',
      "门外的人递来一封沾雨的信。",
      '{"passed":true,"score":92,"issues":[]}',
    ]);

    const { events } = await run(platform);

    expect(calls).toEqual(["chapter_plan", "draft", "continuity_review"]);
    expect(events.find((event) => event.event === "chunk")).toEqual({
      event: "chunk",
      data: { taskId: "job-1", text: "门外的人递来一封沾雨的信。" },
    });
  });

  it("runs targeted rewrite when review reports a serious issue", async () => {
    const { platform, calls } = createPlatform([
      '{"chapterGoal":"推进调查","scenes":[]}',
      "林舟直接说出了凶手身份。",
      '{"passed":false,"score":55,"issues":[{"severity":"high","description":"人物知道了不该知道的信息"}]}',
      "林舟没有说出答案，只把信纸折进了口袋。",
    ]);

    const { events } = await run(platform);

    expect(calls).toEqual([
      "chapter_plan",
      "draft",
      "continuity_review",
      "targeted_rewrite",
    ]);
    expect(events.find((event) => event.event === "chunk")).toEqual({
      event: "chunk",
      data: {
        taskId: "job-1",
        text: "林舟没有说出答案，只把信纸折进了口袋。",
      },
    });
  });
});
