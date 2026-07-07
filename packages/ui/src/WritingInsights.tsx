import type {
  GenerationJob,
  NovelProject,
  TokenUsageRecord,
  UsageSummary,
  WritingStep,
} from "@ai-writer/core";
import type { PlatformService } from "@ai-writer/platform";
import { useCallback, useEffect, useMemo, useState } from "react";

const emptySummary: UsageSummary = {
  requestCount: 0,
  retryCount: 0,
  knownInputTokens: 0,
  knownOutputTokens: 0,
  knownTotalTokens: 0,
  unknownRequestCount: 0,
  providerRequestCount: 0,
  estimatedRequestCount: 0,
};

export interface WritingInsightsProps {
  platform: PlatformService;
}

export function WritingInsights({ platform }: WritingInsightsProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [projectId, setProjectId] = useState<string>();
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [jobId, setJobId] = useState<string>();
  const [steps, setSteps] = useState<WritingStep[]>([]);
  const [requests, setRequests] = useState<TokenUsageRecord[]>([]);
  const [taskSummary, setTaskSummary] = useState<UsageSummary>(emptySummary);
  const [projectSummary, setProjectSummary] = useState<UsageSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? projects[0],
    [projectId, projects],
  );
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === jobId) ?? jobs[0],
    [jobId, jobs],
  );

  const loadProjects = useCallback(async () => {
    const next = await platform.projects.list();
    setProjects(next);
    setProjectId((current) =>
      current && next.some((project) => project.id === current)
        ? current
        : next[0]?.id,
    );
  }, [platform]);

  const loadProject = useCallback(
    async (nextProjectId: string) => {
      const [nextJobs, nextSummary] = await Promise.all([
        platform.generationJobs.listRecent(nextProjectId, 50),
        platform.usage.summarizeProject(nextProjectId),
      ]);
      setJobs(nextJobs);
      setProjectSummary(nextSummary);
      setJobId((current) =>
        current && nextJobs.some((job) => job.id === current)
          ? current
          : nextJobs[0]?.id,
      );
    },
    [platform],
  );

  const loadJob = useCallback(
    async (nextJobId: string) => {
      const [nextSteps, nextRequests, nextSummary] = await Promise.all([
        platform.writing.listSteps(nextJobId),
        platform.usage.listForJob(nextJobId),
        platform.usage.summarizeTask(nextJobId),
      ]);
      setSteps(nextSteps);
      setRequests(nextRequests);
      setTaskSummary(nextSummary);
    },
    [platform],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      await loadProjects();
      if (selectedProject) await loadProject(selectedProject.id);
      if (selectedJob) await loadJob(selectedJob.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [loadJob, loadProject, loadProjects, selectedJob, selectedProject]);

  useEffect(() => {
    if (!open) return;
    void loadProjects().catch(captureError);
  }, [loadProjects, open]);

  useEffect(() => {
    if (!open || !selectedProject) {
      setJobs([]);
      setProjectSummary(emptySummary);
      return;
    }
    void loadProject(selectedProject.id).catch(captureError);
  }, [loadProject, open, selectedProject]);

  useEffect(() => {
    if (!open || !selectedJob) {
      setSteps([]);
      setRequests([]);
      setTaskSummary(emptySummary);
      return;
    }
    void loadJob(selectedJob.id).catch(captureError);
  }, [loadJob, open, selectedJob]);

  function captureError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : String(reason));
  }

  return (
    <>
      <button
        type="button"
        className="writing-insights-launcher"
        onClick={() => setOpen(true)}
      >
        写作统计
      </button>

      {open ? (
        <div className="writing-insights-backdrop" onMouseDown={() => setOpen(false)}>
          <section
            className="writing-insights"
            role="dialog"
            aria-modal="true"
            aria-label="AI 写作任务与 Token 统计"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="writing-insights__header">
              <div>
                <h2>AI 写作任务与 Token 统计</h2>
                <p>仅统计和审计，不设置额度或停止阈值</p>
              </div>
              <div className="writing-insights__header-actions">
                <button type="button" disabled={loading} onClick={() => void refresh()}>
                  {loading ? "刷新中…" : "刷新"}
                </button>
                <button type="button" onClick={() => setOpen(false)}>×</button>
              </div>
            </header>

            {error ? <p className="writing-insights__error">{error}</p> : null}

            <div className="writing-insights__body">
              <aside className="writing-insights__sidebar">
                <label>
                  <span>小说项目</span>
                  <select
                    value={selectedProject?.id ?? ""}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </label>

                <UsageSummaryCard title="项目累计" summary={projectSummary} />

                <h3>最近任务</h3>
                <div className="writing-job-list">
                  {jobs.length === 0 ? <p className="muted">暂无写作任务</p> : null}
                  {jobs.map((job) => (
                    <button
                      type="button"
                      className={job.id === selectedJob?.id ? "active" : ""}
                      key={job.id}
                      onClick={() => setJobId(job.id)}
                    >
                      <strong>{taskTypeLabel(job.taskType)}</strong>
                      <span>{statusLabel(job.status)}</span>
                      <small>{formatTime(job.updatedAt)}</small>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="writing-insights__content">
                {selectedJob ? (
                  <>
                    <section className="writing-job-overview">
                      <div>
                        <h3>{taskTypeLabel(selectedJob.taskType)}</h3>
                        <p>
                          {selectedJob.instruction || "未记录额外写作要求"}
                        </p>
                      </div>
                      <dl>
                        <div><dt>状态</dt><dd>{statusLabel(selectedJob.status)}</dd></div>
                        <div><dt>模型档案</dt><dd>{selectedJob.modelProfileId ?? "未知"}</dd></div>
                        <div><dt>重试</dt><dd>{selectedJob.retryCount}</dd></div>
                        <div><dt>更新时间</dt><dd>{formatTime(selectedJob.updatedAt)}</dd></div>
                      </dl>
                    </section>

                    <UsageSummaryCard title="本次任务" summary={taskSummary} />

                    <section>
                      <h3>写作步骤</h3>
                      <div className="writing-step-list">
                        {steps.length === 0 ? <p className="muted">暂无步骤记录</p> : null}
                        {steps.map((step) => (
                          <article key={step.id}>
                            <header>
                              <strong>{stepTypeLabel(step.stepType)}</strong>
                              <span data-status={step.status}>{stepStatusLabel(step.status)}</span>
                            </header>
                            <div className="writing-step-metrics">
                              <span>尝试 {step.attemptCount}</span>
                              <span>输入 {formatTokens(step.inputTokens)}</span>
                              <span>输出 {formatTokens(step.outputTokens)}</span>
                              <span>总计 {formatTokens(step.totalTokens)}</span>
                              <span>{usageSourceLabel(step.usageSource)}</span>
                              <span>{formatLatency(step.latencyMs)}</span>
                            </div>
                            {step.promptId ? (
                              <small>{step.promptId}@{step.promptVersion ?? "?"}</small>
                            ) : null}
                            {step.errorMessage ? <p className="error-text">{step.errorMessage}</p> : null}
                          </article>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3>Provider 请求明细</h3>
                      <div className="writing-request-table-wrap">
                        <table className="writing-request-table">
                          <thead>
                            <tr>
                              <th>步骤</th>
                              <th>尝试</th>
                              <th>状态</th>
                              <th>模型</th>
                              <th>输入</th>
                              <th>输出</th>
                              <th>总计</th>
                              <th>来源</th>
                              <th>延迟</th>
                            </tr>
                          </thead>
                          <tbody>
                            {requests.map((request) => (
                              <tr key={request.id}>
                                <td>{stepTypeLabel(request.stepType)}</td>
                                <td>{request.attempt}</td>
                                <td>{requestStatusLabel(request.status)}</td>
                                <td>{request.model}</td>
                                <td>{formatTokens(request.inputTokens)}</td>
                                <td>{formatTokens(request.outputTokens)}</td>
                                <td>{formatTokens(request.totalTokens)}</td>
                                <td>{usageSourceLabel(request.source)}</td>
                                <td>{formatLatency(request.latencyMs)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {requests.length === 0 ? <p className="muted">暂无请求明细</p> : null}
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="writing-insights__empty">
                    <p>选择一个写作任务查看步骤和 Token 明细。</p>
                  </div>
                )}
              </main>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function UsageSummaryCard({
  title,
  summary,
}: {
  title: string;
  summary: UsageSummary;
}) {
  return (
    <section className="usage-summary-card">
      <h3>{title}</h3>
      <dl>
        <div><dt>输入</dt><dd>{formatTokens(summary.knownInputTokens)}</dd></div>
        <div><dt>输出</dt><dd>{formatTokens(summary.knownOutputTokens)}</dd></div>
        <div><dt>总计</dt><dd>{formatTokens(summary.knownTotalTokens)}</dd></div>
        <div><dt>请求</dt><dd>{summary.requestCount}</dd></div>
        <div><dt>重试</dt><dd>{summary.retryCount}</dd></div>
        <div><dt>未知</dt><dd>{summary.unknownRequestCount}</dd></div>
      </dl>
      <p>
        精确 {summary.providerRequestCount} · 估算 {summary.estimatedRequestCount} ·
        未知 {summary.unknownRequestCount}
      </p>
    </section>
  );
}

function formatTokens(value: number | undefined): string {
  return value === undefined ? "未知" : new Intl.NumberFormat("zh-CN").format(value);
}

function formatLatency(value: number | undefined): string {
  return value === undefined ? "延迟未知" : `${value} ms`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function taskTypeLabel(value: GenerationJob["taskType"]): string {
  const labels: Record<GenerationJob["taskType"], string> = {
    chapter_generation: "整章生成",
    chapter_continuation: "章节续写",
    scene_generation: "场景生成",
    rewrite: "改写",
    expand: "扩写",
    shorten: "缩写",
    consistency_check: "一致性检查",
    consistency_fix: "一致性修复",
  };
  return labels[value];
}

function statusLabel(value: GenerationJob["status"]): string {
  const labels: Record<GenerationJob["status"], string> = {
    queued: "排队中",
    building_context: "构建上下文",
    planning: "规划中",
    generating: "生成中",
    reviewing: "审查中",
    rewriting: "修订中",
    saving: "保存中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[value];
}

function stepTypeLabel(value: WritingStep["stepType"]): string {
  const labels: Record<WritingStep["stepType"], string> = {
    context_build: "构建上下文",
    chapter_plan: "章节规划",
    scene_plan: "场景规划",
    draft: "生成初稿",
    continuity_review: "连续性审查",
    character_review: "人物审查",
    style_review: "风格审查",
    targeted_rewrite: "定向修订",
    polish: "全文润色",
    memory_extraction: "记忆提取",
    save: "保存章节",
  };
  return labels[value];
}

function stepStatusLabel(value: WritingStep["status"]): string {
  const labels: Record<WritingStep["status"], string> = {
    queued: "等待",
    running: "进行中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
    skipped: "已跳过",
  };
  return labels[value];
}

function requestStatusLabel(value: TokenUsageRecord["status"]): string {
  const labels: Record<TokenUsageRecord["status"], string> = {
    running: "进行中",
    completed: "成功",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[value];
}

function usageSourceLabel(value: TokenUsageRecord["source"] | undefined): string {
  if (value === "provider") return "精确";
  if (value === "estimated") return "估算";
  return "未知";
}
