import { z } from "zod";

export const projectStatusSchema = z.enum([
  "planning",
  "writing",
  "completed",
  "archived",
]);

export const novelProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  genre: z.string().max(100),
  summary: z.string().max(20_000),
  status: projectStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createProjectInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  genre: z.string().trim().max(100).default(""),
  summary: z.string().trim().max(20_000).default(""),
});

export const chapterStatusSchema = z.enum(["planned", "drafting", "completed"]);

export const createVolumeInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(20_000).default(""),
  order: z.number().int().min(0).optional(),
});

export const updateVolumeInputSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
    summary: z.string().trim().max(20_000).optional(),
    order: z.number().int().min(0).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.summary !== undefined ||
      value.order !== undefined,
    "至少需要更新一个卷字段",
  );

export const createChapterInputSchema = z.object({
  projectId: z.string().min(1),
  volumeId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  order: z.number().int().min(0).optional(),
  status: chapterStatusSchema.default("planned"),
});

export const updateChapterMetadataInputSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
    volumeId: z.string().min(1).nullable().optional(),
    order: z.number().int().min(0).optional(),
    status: chapterStatusSchema.optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.volumeId !== undefined ||
      value.order !== undefined ||
      value.status !== undefined,
    "至少需要更新一个章节字段",
  );

export const updateChapterContentInputSchema = z.object({
  chapterId: z.string().min(1),
  contentJson: z.record(z.unknown()),
  contentMarkdown: z.string(),
  plainText: z.string(),
  summary: z.string().max(20_000).optional(),
});

export const createChapterVersionInputSchema = z.object({
  chapterId: z.string().min(1),
  contentJson: z.record(z.unknown()),
  contentMarkdown: z.string(),
  plainText: z.string(),
  changeType: z.enum(["manual", "autosave", "ai_generation", "recovery"]),
  changeReason: z.string().trim().max(500).optional(),
});

export const generationStatusSchema = z.enum([
  "queued",
  "building_context",
  "planning",
  "generating",
  "reviewing",
  "rewriting",
  "saving",
  "completed",
  "failed",
  "cancelled",
]);

export const generationTaskTypeSchema = z.enum([
  "chapter_continuation",
  "scene_generation",
  "rewrite",
  "expand",
  "consistency_check",
]);

export const createGenerationJobInputSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  chapterId: z.string().min(1).optional(),
  providerConfigId: z.string().min(1).optional(),
  modelProfileId: z.string().min(1).optional(),
  taskType: generationTaskTypeSchema,
});

export const updateGenerationJobInputSchema = z.object({
  status: generationStatusSchema.optional(),
  progress: z.number().min(0).max(1).optional(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  retryCount: z.number().int().min(0).optional(),
  errorCode: z.string().max(100).nullable().optional(),
  errorMessage: z.string().max(4_000).nullable().optional(),
});

export const providerTypeSchema = z.enum([
  "openai-compatible",
  "anthropic",
  "gemini",
  "ollama",
]);

export const providerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  providerType: providerTypeSchema,
  baseUrl: z.string().url().optional(),
  apiKeyRef: z.string().min(1).optional(),
  customHeaders: z.record(z.string()).optional(),
});

export const modelProfileSchema = z.object({
  id: z.string().min(1),
  providerConfigId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(200),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  contextWindow: z.number().int().positive().optional(),
  timeoutMs: z.number().int().min(1_000).max(600_000),
  maxRetries: z.number().int().min(0).max(10),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type CreateVolumeInput = z.infer<typeof createVolumeInputSchema>;
export type UpdateVolumeInput = z.infer<typeof updateVolumeInputSchema>;
export type CreateChapterInput = z.infer<typeof createChapterInputSchema>;
export type UpdateChapterMetadataInput = z.infer<
  typeof updateChapterMetadataInputSchema
>;
export type UpdateChapterContentInput = z.infer<
  typeof updateChapterContentInputSchema
>;
export type CreateChapterVersionInput = z.infer<
  typeof createChapterVersionInputSchema
>;
export type CreateGenerationJobInput = z.infer<
  typeof createGenerationJobInputSchema
>;
export type UpdateGenerationJobInput = z.infer<
  typeof updateGenerationJobInputSchema
>;
