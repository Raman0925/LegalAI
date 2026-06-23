import { ModelRouter, CompletionParams, CompletionResult, ModelProvider } from './model-router.js';
import { StreamingProvider } from './streaming-provider.js';
import { CostTracker, CostMetrics } from './cost-tracker.js';

export interface AIService {
  getTrackedCosts(): CostMetrics[];
  complete(
    params: CompletionParams,
    metadata: { feature: string; task: string; tier: string },
    options?: { maxRetries?: number; initialDelayMs?: number }
  ): Promise<CompletionResult & { costMetrics: CostMetrics }>;
  stream(
    params: CompletionParams,
    metadata: { feature: string; task: string; tier: string },
    onChunk: (text: string) => void,
    onDone: (usage: { inputTokens: number; outputTokens: number }) => void
  ): Promise<void>;
}

export function createAIService(
  provider: ModelProvider,
  streaming: StreamingProvider,
  costTracker: CostTracker,
  modelRouter: ModelRouter
): AIService {
  const trackedCosts: CostMetrics[] = [];

  function getTrackedCosts(): CostMetrics[] {
    return trackedCosts;
  }

  function isNonRetryableError(error: any): boolean {
    const msg = error?.message || String(error);
    if (msg.includes('400')) return true;
    if (
      msg.toLowerCase().includes('api key') ||
      msg.toLowerCase().includes('unauthorized') ||
      msg.toLowerCase().includes('invalid key') ||
      msg.includes('401')
    ) return true;
    return false;
  }

  async function complete(
    params: CompletionParams,
    metadata: { feature: string; task: string; tier: string },
    options: { maxRetries?: number; initialDelayMs?: number } = {}
  ): Promise<CompletionResult & { costMetrics: CostMetrics }> {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 1000;
    let attempt = 0;

    while (true) {
      try {
        const result = await provider.complete(params);
        const costMetrics = costTracker.track(
          metadata.feature,
          metadata.task,
          metadata.tier,
          result.usage
        );
        trackedCosts.push(costMetrics);
        return { ...result, costMetrics };
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries || isNonRetryableError(err)) throw err;
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async function stream(
    params: CompletionParams,
    metadata: { feature: string; task: string; tier: string },
    onChunk: (text: string) => void,
    onDone: (usage: { inputTokens: number; outputTokens: number }) => void
  ): Promise<void> {
    await streaming.streamComplete(params, onChunk, (usage) => {
      const costMetrics = costTracker.track(
        metadata.feature,
        metadata.task,
        metadata.tier,
        usage
      );
      trackedCosts.push(costMetrics);
      onDone(usage);
    });
  }

  return { getTrackedCosts, complete, stream };
}
