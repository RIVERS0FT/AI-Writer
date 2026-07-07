import type {
  ConnectionTestResult,
  GenerateCallbacks,
  GenerateRequest,
  GenerateResult,
  ModelProvider,
  ProviderConfig,
} from "./types";

export class MockModelProvider implements ModelProvider {
  private readonly aborted = new Set<string>();

  async testConnection(_config: ProviderConfig): Promise<ConnectionTestResult> {
    return { ok: true, latencyMs: 1, message: "Mock provider is ready" };
  }

  async generate(
    request: GenerateRequest,
    callbacks: GenerateCallbacks,
  ): Promise<GenerateResult> {
    const parts = [
      "夜色压在城墙上。",
      "林墨握紧青铜钥匙，沿着潮湿的石阶走入地下室。",
      "门后的王室档案，终于揭开了失踪事件的一角。",
    ];

    let text = "";
    for (const part of parts) {
      if (this.aborted.has(request.taskId)) {
        this.aborted.delete(request.taskId);
        throw new Error("Generation cancelled");
      }
      text += part;
      callbacks.onChunk({ taskId: request.taskId, text: part, done: false });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    callbacks.onChunk({ taskId: request.taskId, text: "", done: true });
    return { taskId: request.taskId, text };
  }

  async abort(taskId: string): Promise<void> {
    this.aborted.add(taskId);
  }
}
