import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createModelRouter, ModelRouter, ModelConfig } from '../model-router.js';
import { createAnthropicProvider } from '../anthropic-provider.js';
import { ChatAnthropic } from '@langchain/anthropic';

vi.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: vi.fn().mockImplementation(() => {
      return {
        invoke: vi.fn(),
      };
    }),
  };
});

describe('ModelRouter', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = createModelRouter();
  });

  it('getModel returns correct model for task and tier', () => {
    const cheapChatConfig = router.getModel('chat', 'cheap');
    expect(cheapChatConfig.modelName).toBe('claude-haiku-4-5');
    expect(cheapChatConfig.inputCostPerMillion).toBe(0.8);

    const premiumChatConfig = router.getModel('chat', 'premium');
    expect(premiumChatConfig.modelName).toBe('claude-sonnet-4-6');
    expect(premiumChatConfig.inputCostPerMillion).toBe(3.0);

    expect(() => router.getModel('unknown-task', 'cheap')).toThrowError(/Unknown task/);
    expect(() => router.getModel('chat', 'unknown-tier')).toThrowError(/Unknown tier/);
  });

  it('estimateCost calculates correctly', () => {
    const testConfig: ModelConfig = {
      modelName: 'test-model',
      inputCostPerMillion: 1.5,
      outputCostPerMillion: 5.0,
    };

    const cost1 = router.estimateCost(testConfig, 1_000_000, 1_000_000);
    expect(cost1).toBeCloseTo(6.5, 5);

    const cost2 = router.estimateCost(testConfig, 500_000, 100_000);
    expect(cost2).toBeCloseTo(1.25, 5);

    const cost3 = router.estimateCost(testConfig, 0, 0);
    expect(cost3).toBe(0);
  });
});

describe('AnthropicProvider', () => {
  const apiKey = 'test-anthropic-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('complete normalizes response correctly', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      content: 'Hello there, how can I help you today?',
      usage_metadata: {
        input_tokens: 150,
        output_tokens: 45,
      },
    });

    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        invoke: mockInvoke,
      } as any;
    });

    const provider = createAnthropicProvider(apiKey);
    const result = await provider.complete({
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant.',
    });

    expect(result).toEqual({
      text: 'Hello there, how can I help you today?',
      usage: {
        inputTokens: 150,
        outputTokens: 45,
      },
    });

    expect(ChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5',
        apiKey: apiKey,
        temperature: 0.7,
      }),
    );
    expect(mockInvoke).toHaveBeenCalled();
  });
});
