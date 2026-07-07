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

export const providerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  providerType: z.string().min(1),
  baseUrl: z.string().url().optional(),
  apiKeyRef: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
