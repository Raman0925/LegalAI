import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createModelRouter, ModelRouter } from '../model-router.js';
import { createCostTracker, CostTracker, CostMetrics } from '../cost-tracker.js';
import { createStreamingProvider } from '../streaming-provider.js';
import { ChatAnthropic } from '@langchain/anthropic';

vi.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: vi.fn().mockImplementation(() => {
      return {
        stream: vi.fn(),
      };
    }),
  };
});

describe('CostTracker', () => {
  let router: ModelRouter;
  let tracker: CostTracker;

  beforeEach(() => {
    router = createModelRouter();
    tracker = createCostTracker(router);
  });

  it('CostTracker.track calculates cost correctly', () => {
    const metrics = tracker.track('customer_chat', 'chat', 'cheap', {
      inputTokens: 500_000,
      outputTokens: 250_000
    });

    expect(metrics).toEqual({
      feature: 'customer_chat',
      task: 'chat',
      tier: 'cheap',
      inputTokens: 500_000,
      outputTokens: 250_000,
      cost: 1.40
    });
  });

  it('CostTracker.summarize aggregates by feature correctly', () => {
    const metrics: CostMetrics[] = [
      {
        feature: 'chat_bot',
        task: 'chat',
        tier: 'cheap',
        inputTokens: 100_000,
        outputTokens: 50_000,
        cost: 0.28
      },
      {
        feature: 'summarizer',
        task: 'chat',
        tier: 'premium',
        inputTokens: 200_000,
        outputTokens: 100_000,
        cost: 2.10
      },
      {
        feature: 'chat_bot',
        task: 'chat',
        tier: 'premium',
        inputTokens: 100_000,
        outputTokens: 50_000,
        cost: 1.05
      }
    ];

    const summary = tracker.summarize(metrics);

    expect(summary.totalCost).toBeCloseTo(3.43, 5);
    expect(summary.totalTokens).toEqual({
      input: 400_000,
      output: 200_000
    });

    expect(summary.byFeature['chat_bot']).toEqual({
      cost: 1.33,
      inputTokens: 200_000,
      outputTokens: 100_000
    });

    expect(summary.byFeature['summarizer']).toEqual({
      cost: 2.10,
      inputTokens: 200_000,
      outputTokens: 100_000
    });
  });

  it('CostTracker.summarize returns an empty report when no metrics are provided', () => {
    const summary = tracker.summarize([]);
    expect(summary.totalCost).toBe(0);
    expect(summary.totalTokens).toEqual({ input: 0, output: 0 });
    expect(summary.byFeature).toEqual({});
  });
});

describe('StreamingProvider', () => {
  const apiKey = 'test-streaming-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('StreamingProvider calls onChunk for each delta', async () => {
    const mockChunks = [
      {
        content: 'Streaming',
        usage_metadata: { input_tokens: 120 }
      },
      {
        content: ' is',
      },
      {
        content: ' fun!',
        usage_metadata: { output_tokens: 45 }
      }
    ];

    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        for (const c of mockChunks) {
          yield c;
        }
      }
    };

    const mockStreamFn = vi.fn().mockResolvedValue(mockStream);
    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        stream: mockStreamFn
      } as any;
    });

    const provider = createStreamingProvider(apiKey);
    const chunks: string[] = [];
    let finalUsage: { inputTokens: number; outputTokens: number } | null = null;

    await provider.streamComplete(
      {
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: 'test stream' }]
      },
      (chunk) => {
        chunks.push(chunk);
      },
      (usage) => {
        finalUsage = usage;
      }
    );

    expect(chunks).toEqual(['Streaming', ' is', ' fun!']);
    expect(finalUsage).toEqual({
      inputTokens: 120,
      outputTokens: 45
    });

    expect(ChatAnthropic).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-haiku-4-5',
      apiKey: apiKey,
      streaming: true
    }));
    expect(mockStreamFn).toHaveBeenCalled();
  });

  it('StreamingProvider throws error when API response is not OK', async () => {
    const mockStreamFn = vi.fn().mockRejectedValue(new Error('Internal Server Error'));
    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        stream: mockStreamFn
      } as any;
    });

    const provider = createStreamingProvider(apiKey);
    await expect(
      provider.streamComplete(
        {
          model: 'claude-haiku-4-5',
          messages: [{ role: 'user', content: 'test stream' }]
        },
        () => {},
        () => {}
      )
    ).rejects.toThrowError('Internal Server Error');
  });
});
