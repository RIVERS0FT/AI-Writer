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
