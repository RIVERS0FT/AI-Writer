import type {
  Character,
  NovelProject,
  OutlineNode,
  OutlineNodeType,
  WorldEntry,
} from "@ai-writer/core";
import type { KnowledgeRepository, PlatformService } from "@ai-writer/platform";
import { useCallback, useEffect, useMemo, useState } from "react";

type LibraryTab = "characters" | "world" | "outline";
type LibraryItem = Character | WorldEntry | OutlineNode;

interface CharacterForm {
  id: string;
  name: string;
  aliases: string;
  profile: string;
  motivation: string;
  currentState: string;
  isLocked: boolean;
}

interface WorldForm {
  id: string;
  entryType: string;
  title: string;
  content: string;
  isLocked: boolean;
}

interface OutlineForm {
  id: string;
  nodeType: OutlineNodeType;
  title: string;
  content: string;
  isLocked: boolean;
}

const emptyCharacter = (): CharacterForm => ({
  id: "",
  name: "",
  aliases: "",
  profile: "",
  motivation: "",
  currentState: "",
  isLocked: false,
});

const emptyWorld = (): WorldForm => ({
  id: "",
  entryType: "setting",
  title: "",
  content: "",
  isLocked: false,
});

const emptyOutline = (): OutlineForm => ({
  id: "",
  nodeType: "story",
  title: "",
  content: "",
  isLocked: false,
});

export interface KnowledgeLibraryProps {
  platform: PlatformService;
}

export function KnowledgeLibrary({ platform }: KnowledgeLibraryProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [projectId, setProjectId] = useState<string>();
  const [tab, setTab] = useState<LibraryTab>("characters");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>([]);
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>([]);
  const [characterForm, setCharacterForm] = useState<CharacterForm>(emptyCharacter);
  const [worldForm, setWorldForm] = useState<WorldForm>(emptyWorld);
  const [outlineForm, setOutlineForm] = useState<OutlineForm>(emptyOutline);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();

  const repository = platform.knowledge;
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? projects[0],
    [projectId, projects],
  );

  const refreshProjects = useCallback(async () => {
    const next = await platform.projects.list();
    setProjects(next);
    setProjectId((current) =>
      current && next.some((project) => project.id === current)
        ? current
        : next[0]?.id,
    );
  }, [platform]);

  const refresh = useCallback(
    async (nextProjectId: string) => {
      if (!repository) return;
      const [nextCharacters, nextWorld, nextOutline] = await Promise.all([
        repository.listCharacters(nextProjectId),
        repository.listWorldEntries(nextProjectId),
        repository.listOutlineNodes(nextProjectId),
      ]);
      setCharacters(nextCharacters);
      setWorldEntries(nextWorld);
      setOutlineNodes(nextOutline);
    },
    [repository],
  );

  useEffect(() => {
    if (!open) return;
    void refreshProjects().catch(captureError);
  }, [open, refreshProjects]);

  useEffect(() => {
    if (!open || !selectedProject) return;
    void refresh(selectedProject.id).catch(captureError);
  }, [open, refresh, selectedProject]);

  function captureError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : String(reason));
  }

  function resetForm(nextTab = tab) {
    if (nextTab === "characters") setCharacterForm(emptyCharacter());
    if (nextTab === "world") setWorldForm(emptyWorld());
    if (nextTab === "outline") setOutlineForm(emptyOutline());
    setError(undefined);
    setMessage("");
  }

  function selectItem(item: LibraryItem) {
    if ("name" in item) {
      setCharacterForm({
        id: item.id,
        name: item.name,
        aliases: item.aliases.join("，"),
        profile: item.profile,
        motivation: item.motivation,
        currentState: item.currentState,
        isLocked: item.isLocked,
      });
    } else if ("entryType" in item) {
      setWorldForm({
        id: item.id,
        entryType: item.entryType,
        title: item.title,
        content: item.content,
        isLocked: item.isLocked,
      });
    } else {
      setOutlineForm({
        id: item.id,
        nodeType: item.nodeType,
        title: item.title,
        content: item.content,
        isLocked: item.isLocked,
      });
    }
    setMessage("");
    setError(undefined);
  }

  async function saveCharacter(repo: KnowledgeRepository, project: NovelProject) {
    const aliases = characterForm.aliases
      .split(/[，,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (characterForm.id) {
      await repo.updateCharacter({
        id: characterForm.id,
        name: characterForm.name,
        aliases,
        profile: characterForm.profile,
        motivation: characterForm.motivation,
        currentState: characterForm.currentState,
        isLocked: characterForm.isLocked,
      });
    } else {
      await repo.createCharacter({
        projectId: project.id,
        name: characterForm.name,
        aliases,
        profile: characterForm.profile,
        motivation: characterForm.motivation,
        currentState: characterForm.currentState,
        isLocked: characterForm.isLocked,
      });
    }
  }

  async function saveWorld(repo: KnowledgeRepository, project: NovelProject) {
    if (worldForm.id) {
      await repo.updateWorldEntry({
        id: worldForm.id,
        entryType: worldForm.entryType,
        title: worldForm.title,
        content: worldForm.content,
        isLocked: worldForm.isLocked,
      });
    } else {
      await repo.createWorldEntry({
        projectId: project.id,
        entryType: worldForm.entryType,
        title: worldForm.title,
        content: worldForm.content,
        isLocked: worldForm.isLocked,
      });
    }
  }

  async function saveOutline(repo: KnowledgeRepository, project: NovelProject) {
    if (outlineForm.id) {
      await repo.updateOutlineNode({
        id: outlineForm.id,
        nodeType: outlineForm.nodeType,
        title: outlineForm.title,
        content: outlineForm.content,
        isLocked: outlineForm.isLocked,
      });
    } else {
      await repo.createOutlineNode({
        projectId: project.id,
        nodeType: outlineForm.nodeType,
        title: outlineForm.title,
        content: outlineForm.content,
        isLocked: outlineForm.isLocked,
      });
    }
  }

  async function save() {
    if (!repository || !selectedProject) return;
    setBusy(true);
    setError(undefined);
    try {
      if (tab === "characters") await saveCharacter(repository, selectedProject);
      if (tab === "world") await saveWorld(repository, selectedProject);
      if (tab === "outline") await saveOutline(repository, selectedProject);
      await refresh(selectedProject.id);
      resetForm(tab);
      setMessage("资料已保存");
    } catch (reason) {
      captureError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!repository || !selectedProject) return;
    const id =
      tab === "characters"
        ? characterForm.id
        : tab === "world"
          ? worldForm.id
          : outlineForm.id;
    if (!id || !globalThis.confirm("删除当前资料？")) return;
    setBusy(true);
    try {
      if (tab === "characters") await repository.deleteCharacter(id);
      if (tab === "world") await repository.deleteWorldEntry(id);
      if (tab === "outline") await repository.deleteOutlineNode(id);
      await refresh(selectedProject.id);
      resetForm(tab);
      setMessage("资料已删除");
    } catch (reason) {
      captureError(reason);
    } finally {
      setBusy(false);
    }
  }

  const items: LibraryItem[] =
    tab === "characters"
      ? characters
      : tab === "world"
        ? worldEntries
        : outlineNodes;

  return (
    <>
      <button
        type="button"
        className="knowledge-library-launcher"
        onClick={() => setOpen(true)}
      >
        小说资料库
      </button>

      {open ? (
        <div className="knowledge-backdrop" onMouseDown={() => setOpen(false)}>
          <section
            className="knowledge-library"
            role="dialog"
            aria-modal="true"
            aria-label="小说资料库"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="knowledge-header">
              <div>
                <h2>小说资料库</h2>
                <p>人物、世界观和大纲均使用纯文本维护</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </header>

            {!repository ? (
              <p className="error-text">当前平台未加载资料库服务</p>
            ) : (
              <div className="knowledge-body">
                <aside className="knowledge-nav">
                  <label>
                    <span>项目</span>
                    <select
                      value={selectedProject?.id ?? ""}
                      onChange={(event) => setProjectId(event.target.value)}
                    >
                      {projects.map((project) => (
                        <option value={project.id} key={project.id}>{project.title}</option>
                      ))}
                    </select>
                  </label>
                  <div className="knowledge-tabs">
                    {(["characters", "world", "outline"] as const).map((value) => (
                      <button
                        type="button"
                        className={tab === value ? "active" : ""}
                        key={value}
                        onClick={() => {
                          setTab(value);
                          resetForm(value);
                        }}
                      >
                        {value === "characters" ? "人物" : value === "world" ? "世界观" : "大纲"}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => resetForm(tab)}>+ 新建资料</button>
                  <div className="knowledge-list">
                    {items.map((item) => (
                      <button type="button" key={item.id} onClick={() => selectItem(item)}>
                        <strong>{"name" in item ? item.name : item.title}</strong>
                        <small>
                          {"entryType" in item
                            ? item.entryType
                            : "nodeType" in item
                              ? item.nodeType
                              : item.aliases.join(" / ") || "人物"}
                        </small>
                      </button>
                    ))}
                  </div>
                </aside>

                <main className="knowledge-form">
                  {tab === "characters" ? (
                    <CharacterFields form={characterForm} setForm={setCharacterForm} />
                  ) : tab === "world" ? (
                    <WorldFields form={worldForm} setForm={setWorldForm} />
                  ) : (
                    <OutlineFields form={outlineForm} setForm={setOutlineForm} />
                  )}
                  {message ? <p className="form-status success">{message}</p> : null}
                  {error ? <p className="form-status error">{error}</p> : null}
                  <footer className="knowledge-actions">
                    <button type="button" className="danger-button" disabled={busy} onClick={() => void remove()}>
                      删除
                    </button>
                    <button type="button" className="primary-button" disabled={busy} onClick={() => void save()}>
                      {busy ? "处理中…" : "保存资料"}
                    </button>
                  </footer>
                </main>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function CharacterFields({
  form,
  setForm,
}: {
  form: CharacterForm;
  setForm(value: CharacterForm): void;
}) {
  return (
    <div className="knowledge-fields">
      <label><span>姓名</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label><span>别名（逗号分隔）</span><input value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} /></label>
      <label><span>人物设定</span><textarea rows={8} value={form.profile} onChange={(event) => setForm({ ...form, profile: event.target.value })} /></label>
      <label><span>核心动机</span><textarea rows={5} value={form.motivation} onChange={(event) => setForm({ ...form, motivation: event.target.value })} /></label>
      <label><span>当前状态</span><textarea rows={5} value={form.currentState} onChange={(event) => setForm({ ...form, currentState: event.target.value })} /></label>
      <LockField value={form.isLocked} onChange={(isLocked) => setForm({ ...form, isLocked })} />
    </div>
  );
}

function WorldFields({ form, setForm }: { form: WorldForm; setForm(value: WorldForm): void }) {
  return (
    <div className="knowledge-fields">
      <label><span>类型</span><input value={form.entryType} onChange={(event) => setForm({ ...form, entryType: event.target.value })} /></label>
      <label><span>标题</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>设定内容</span><textarea rows={18} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
      <LockField value={form.isLocked} onChange={(isLocked) => setForm({ ...form, isLocked })} />
    </div>
  );
}

function OutlineFields({ form, setForm }: { form: OutlineForm; setForm(value: OutlineForm): void }) {
  return (
    <div className="knowledge-fields">
      <label>
        <span>节点类型</span>
        <select value={form.nodeType} onChange={(event) => setForm({ ...form, nodeType: event.target.value as OutlineNodeType })}>
          <option value="story">全书</option><option value="volume">卷</option><option value="chapter">章</option><option value="scene">场景</option><option value="note">备注</option>
        </select>
      </label>
      <label><span>标题</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>大纲内容</span><textarea rows={18} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
      <LockField value={form.isLocked} onChange={(isLocked) => setForm({ ...form, isLocked })} />
    </div>
  );
}

function LockField({ value, onChange }: { value: boolean; onChange(value: boolean): void }) {
  return (
    <label className="knowledge-lock">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span>锁定为权威资料，后续 AI 提取不得自动覆盖</span>
    </label>
  );
}
