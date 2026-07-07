import type { ModelProfile, ProviderConfig } from "@ai-writer/providers";
import type { ProviderRepository } from "@ai-writer/platform";
import { modelProfileSchema, providerConfigSchema } from "@ai-writer/schemas";
import type Database from "@tauri-apps/plugin-sql";

interface ProviderRow {
  id: string;
  name: string;
  provider_type: string;
  base_url: string | null;
  api_key_ref: string | null;
  custom_headers_json: string;
}

interface ModelProfileRow {
  id: string;
  provider_config_id: string;
  name: string;
  model: string;
  temperature: number;
  top_p: number | null;
  max_output_tokens: number | null;
  context_window: number | null;
  timeout_ms: number;
  max_retries: number;
}

function parseHeaders(json: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function mapProvider(row: ProviderRow): ProviderConfig {
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    ...(row.base_url ? { baseUrl: row.base_url } : {}),
    ...(row.api_key_ref ? { apiKeyRef: row.api_key_ref } : {}),
    customHeaders: parseHeaders(row.custom_headers_json),
  };
}

function mapModelProfile(row: ModelProfileRow): ModelProfile {
  return {
    id: row.id,
    providerConfigId: row.provider_config_id,
    name: row.name,
    model: row.model,
    temperature: row.temperature,
    ...(row.top_p !== null ? { topP: row.top_p } : {}),
    ...(row.max_output_tokens !== null
      ? { maxOutputTokens: row.max_output_tokens }
      : {}),
    ...(row.context_window !== null ? { contextWindow: row.context_window } : {}),
    timeoutMs: row.timeout_ms,
    maxRetries: row.max_retries,
  };
}

export function createProviderRepository(database: Database): ProviderRepository {
  return {
    async listProviders() {
      const rows = await database.select<ProviderRow[]>(
        `SELECT id, name, provider_type, base_url, api_key_ref, custom_headers_json
         FROM provider_configs
         ORDER BY updated_at DESC`,
      );
      return rows.map(mapProvider);
    },

    async saveProvider(config) {
      const parsed = providerConfigSchema.parse(config);
      const now = new Date().toISOString();
      await database.execute(
        `INSERT INTO provider_configs
          (id, name, provider_type, base_url, api_key_ref, custom_headers_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          provider_type = excluded.provider_type,
          base_url = excluded.base_url,
          api_key_ref = excluded.api_key_ref,
          custom_headers_json = excluded.custom_headers_json,
          updated_at = excluded.updated_at`,
        [
          parsed.id,
          parsed.name,
          parsed.providerType,
          parsed.baseUrl ?? null,
          parsed.apiKeyRef ?? null,
          JSON.stringify(parsed.customHeaders ?? {}),
          now,
        ],
      );
      return parsed;
    },

    async deleteProvider(id) {
      await database.execute("DELETE FROM provider_configs WHERE id = $1", [id]);
    },

    async listModelProfiles(providerConfigId) {
      const rows = await database.select<ModelProfileRow[]>(
        `SELECT id, provider_config_id, name, model, temperature, top_p,
                max_output_tokens, context_window, timeout_ms, max_retries
         FROM model_profiles
         WHERE provider_config_id = $1
         ORDER BY updated_at DESC`,
        [providerConfigId],
      );
      return rows.map(mapModelProfile);
    },

    async saveModelProfile(profile) {
      const parsed = modelProfileSchema.parse(profile);
      const now = new Date().toISOString();
      await database.execute(
        `INSERT INTO model_profiles
          (id, provider_config_id, name, model, temperature, top_p,
           max_output_tokens, context_window, timeout_ms, max_retries,
           created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
         ON CONFLICT(id) DO UPDATE SET
          provider_config_id = excluded.provider_config_id,
          name = excluded.name,
          model = excluded.model,
          temperature = excluded.temperature,
          top_p = excluded.top_p,
          max_output_tokens = excluded.max_output_tokens,
          context_window = excluded.context_window,
          timeout_ms = excluded.timeout_ms,
          max_retries = excluded.max_retries,
          updated_at = excluded.updated_at`,
        [
          parsed.id,
          parsed.providerConfigId,
          parsed.name,
          parsed.model,
          parsed.temperature,
          parsed.topP ?? null,
          parsed.maxOutputTokens ?? null,
          parsed.contextWindow ?? null,
          parsed.timeoutMs,
          parsed.maxRetries,
          now,
        ],
      );
      return parsed;
    },

    async deleteModelProfile(id) {
      await database.execute("DELETE FROM model_profiles WHERE id = $1", [id]);
    },
  };
}
