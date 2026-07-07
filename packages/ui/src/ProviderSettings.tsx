import type { PlatformService } from "@ai-writer/platform";
import type { ModelProfile, ProviderConfig } from "@ai-writer/providers";
import { useCallback, useEffect, useState } from "react";

interface ProviderSettingsProps {
  open: boolean;
  platform: PlatformService;
  onClose(): void;
  onChanged(): void;
}

interface ProviderFormState {
  id: string;
  name: string;
  providerType: "openai-compatible" | "anthropic" | "gemini" | "ollama";
  baseUrl: string;
  apiKeyRef: string;
  apiKey: string;
  vaultPassword: string;
  customHeaders: string;
  profileId: string;
  profileName: string;
  model: string;
  temperature: string;
  topP: string;
  maxOutputTokens: string;
  contextWindow: string;
  timeoutMs: string;
  maxRetries: string;
}

const emptyForm = (): ProviderFormState => ({
  id: "",
  name: "",
  providerType: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  apiKeyRef: "",
  apiKey: "",
  vaultPassword: "",
  customHeaders: "{}",
  profileId: "",
  profileName: "默认写作模型",
  model: "",
  temperature: "0.8",
  topP: "",
  maxOutputTokens: "8000",
  contextWindow: "",
  timeoutMs: "120000",
  maxRetries: "2",
});

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const number = Number(trimmed);
  if (!Number.isFinite(number)) throw new Error(`无效数字：${value}`);
  return number;
}

function requiredNumber(value: string, field: string): number {
  const number = optionalNumber(value);
  if (number === undefined) throw new Error(`${field}不能为空`);
  return number;
}

function parseHeaders(value: string): Record<string, string> {
  const parsed: unknown = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("自定义请求头必须是 JSON 对象");
  }

  const entries = Object.entries(parsed);
  if (!entries.every(([, item]) => typeof item === "string")) {
    throw new Error("自定义请求头的值必须全部为字符串");
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

export function ProviderSettings({
  open,
  platform,
  onClose,
  onChanged,
}: ProviderSettingsProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [form, setForm] = useState<ProviderFormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const items = await platform.providers.listProviders();
    setProviders(items);
  }, [platform]);

  useEffect(() => {
    if (!open) return;
    void refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, [open, refresh]);

  async function selectProvider(provider: ProviderConfig) {
    setError(undefined);
    setStatus(undefined);
    const profiles = await platform.providers.listModelProfiles(provider.id);
    const profile = profiles[0];
    setForm({
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType as ProviderFormState["providerType"],
      baseUrl: provider.baseUrl ?? "",
      apiKeyRef: provider.apiKeyRef ?? "",
      apiKey: "",
      vaultPassword: "",
      customHeaders: JSON.stringify(provider.customHeaders ?? {}, null, 2),
      profileId: profile?.id ?? "",
      profileName: profile?.name ?? "默认写作模型",
      model: profile?.model ?? "",
      temperature: String(profile?.temperature ?? 0.8),
      topP: profile?.topP === undefined ? "" : String(profile.topP),
      maxOutputTokens:
        profile?.maxOutputTokens === undefined
          ? "8000"
          : String(profile.maxOutputTokens),
      contextWindow:
        profile?.contextWindow === undefined ? "" : String(profile.contextWindow),
      timeoutMs: String(profile?.timeoutMs ?? 120000),
      maxRetries: String(profile?.maxRetries ?? 2),
    });
  }

  async function ensureUnlocked(): Promise<void> {
    if (platform.secureStorage.isUnlocked()) return;
    await platform.secureStorage.unlock(form.vaultPassword);
  }

  async function resolveApiKey(apiKeyRef: string): Promise<string> {
    await ensureUnlocked();
    if (form.apiKey.trim()) return form.apiKey.trim();
    const stored = await platform.secureStorage.getSecret(apiKeyRef);
    if (!stored) throw new Error("未找到 API Key，请重新输入");
    return stored;
  }

  function buildProvider(): ProviderConfig {
    const id = form.id || crypto.randomUUID();
    const apiKeyRef = form.apiKeyRef || `provider:${id}:api-key`;
    const headers = parseHeaders(form.customHeaders);
    return {
      id,
      name: form.name.trim(),
      providerType: form.providerType,
      apiKeyRef,
      customHeaders: headers,
      ...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
    };
  }

  function buildProfile(providerId: string): ModelProfile {
    const topP = optionalNumber(form.topP);
    const maxOutputTokens = optionalNumber(form.maxOutputTokens);
    const contextWindow = optionalNumber(form.contextWindow);

    return {
      id: form.profileId || crypto.randomUUID(),
      providerConfigId: providerId,
      name: form.profileName.trim(),
      model: form.model.trim(),
      temperature: requiredNumber(form.temperature, "温度"),
      timeoutMs: requiredNumber(form.timeoutMs, "超时时间"),
      maxRetries: requiredNumber(form.maxRetries, "重试次数"),
      ...(topP !== undefined ? { topP } : {}),
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
      ...(contextWindow !== undefined ? { contextWindow } : {}),
    };
  }

  async function save() {
    setBusy(true);
    setError(undefined);
    setStatus(undefined);
    try {
      const provider = buildProvider();
      const profile = buildProfile(provider.id);
      await ensureUnlocked();
      if (form.apiKey.trim()) {
        await platform.secureStorage.setSecret(
          provider.apiKeyRef ?? `provider:${provider.id}:api-key`,
          form.apiKey.trim(),
        );
      } else if (!form.id) {
        throw new Error("新建 Provider 时必须输入 API Key");
      }

      await platform.providers.saveProvider(provider);
      await platform.providers.saveModelProfile(profile);
      await refresh();
      setForm((current) => ({
        ...current,
        id: provider.id,
        apiKeyRef: provider.apiKeyRef ?? "",
        profileId: profile.id,
        apiKey: "",
      }));
      setStatus("Provider 和模型配置已保存");
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setError(undefined);
    setStatus(undefined);
    try {
      const provider = buildProvider();
      const apiKeyRef = provider.apiKeyRef ?? `provider:${provider.id}:api-key`;
      await ensureUnlocked();
      if (form.apiKey.trim()) {
        await platform.secureStorage.setSecret(apiKeyRef, form.apiKey.trim());
      } else {
        await resolveApiKey(apiKeyRef);
      }
      const result = await platform.providerRuntime.testConnection(provider);
      if (!result.ok) throw new Error(result.message);
      setStatus(`${result.message}，耗时 ${result.latencyMs} ms`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!form.id) return;
    setBusy(true);
    setError(undefined);
    try {
      if (form.apiKeyRef) {
        await ensureUnlocked();
        await platform.secureStorage.removeSecret(form.apiKeyRef);
      }
      await platform.providers.deleteProvider(form.id);
      await refresh();
      setForm(emptyForm());
      setStatus("Provider 已删除");
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="provider-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="provider-modal__header">
          <div>
            <h2 id="provider-settings-title">模型服务设置</h2>
            <p>API Key 使用本地密钥库存储，不写入 SQLite。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭设置">×</button>
        </header>

        <div className="provider-modal__body">
          <aside className="provider-nav">
            <button
              type="button"
              className="provider-nav__new"
              onClick={() => setForm(emptyForm())}
            >
              + 新建 Provider
            </button>
            {providers.map((provider) => (
              <button
                type="button"
                className={provider.id === form.id ? "active" : ""}
                key={provider.id}
                onClick={() => void selectProvider(provider)}
              >
                <span>{provider.name}</span>
                <small>{provider.providerType}</small>
              </button>
            ))}
          </aside>

          <div className="provider-form">
            <div className="form-grid">
              <label>
                <span>名称</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="我的 DeepSeek"
                />
              </label>
              <label>
                <span>服务类型</span>
                <select
                  value={form.providerType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      providerType: event.target.value as ProviderFormState["providerType"],
                    })
                  }
                >
                  <option value="openai-compatible">OpenAI Compatible</option>
                  <option value="anthropic" disabled>Anthropic（待实现）</option>
                  <option value="gemini" disabled>Gemini（待实现）</option>
                  <option value="ollama" disabled>Ollama（待实现）</option>
                </select>
              </label>
              <label className="span-2">
                <span>Base URL</span>
                <input
                  value={form.baseUrl}
                  onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              <label>
                <span>密钥库密码</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={form.vaultPassword}
                  onChange={(event) =>
                    setForm({ ...form, vaultPassword: event.target.value })
                  }
                  placeholder={
                    platform.secureStorage.isUnlocked() ? "密钥库已解锁" : "本次会话输入"
                  }
                />
              </label>
              <label>
                <span>API Key</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={form.apiKey}
                  onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                  placeholder={form.id ? "留空则保留原密钥" : "输入 API Key"}
                />
              </label>
              <label className="span-2">
                <span>自定义请求头 JSON</span>
                <textarea
                  rows={4}
                  value={form.customHeaders}
                  onChange={(event) =>
                    setForm({ ...form, customHeaders: event.target.value })
                  }
                />
              </label>
            </div>

            <h3>模型档案</h3>
            <div className="form-grid">
              <label>
                <span>档案名称</span>
                <input
                  value={form.profileName}
                  onChange={(event) =>
                    setForm({ ...form, profileName: event.target.value })
                  }
                />
              </label>
              <label>
                <span>模型 ID</span>
                <input
                  value={form.model}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                  placeholder="gpt-4.1-mini"
                />
              </label>
              <label><span>温度</span><input value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value })} /></label>
              <label><span>Top P</span><input value={form.topP} onChange={(event) => setForm({ ...form, topP: event.target.value })} /></label>
              <label><span>最大输出 Token</span><input value={form.maxOutputTokens} onChange={(event) => setForm({ ...form, maxOutputTokens: event.target.value })} /></label>
              <label><span>上下文窗口</span><input value={form.contextWindow} onChange={(event) => setForm({ ...form, contextWindow: event.target.value })} /></label>
              <label><span>超时（毫秒）</span><input value={form.timeoutMs} onChange={(event) => setForm({ ...form, timeoutMs: event.target.value })} /></label>
              <label><span>重试次数</span><input value={form.maxRetries} onChange={(event) => setForm({ ...form, maxRetries: event.target.value })} /></label>
            </div>

            {status ? <p className="form-status success">{status}</p> : null}
            {error ? <p className="form-status error">{error}</p> : null}

            <footer className="provider-form__actions">
              {form.id ? (
                <button type="button" className="danger-button" disabled={busy} onClick={() => void remove()}>
                  删除
                </button>
              ) : <span />}
              <div>
                <button type="button" disabled={busy} onClick={() => void testConnection()}>
                  测试连接
                </button>
                <button type="button" className="primary-button" disabled={busy} onClick={() => void save()}>
                  {busy ? "处理中…" : "保存配置"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}
