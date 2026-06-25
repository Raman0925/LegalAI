process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.COHERE_API_KEY = 'test-cohere-key';
process.env.DATABASE_URL = 'postgresql://localhost:5432/postgres';

import { vi, describe, it, expect, beforeEach } from 'vitest';

const {
  mockRetrieve,
  mockAssemble,
  mockGetBudget,
  mockGetTokenCount,
  mockGetModel,
  mockComplete,
  mockStreamComplete,
} = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
  mockAssemble: vi.fn(),
  mockGetBudget: vi.fn(),
  mockGetTokenCount: vi.fn(),
  mockGetModel: vi.fn(),
  mockComplete: vi.fn(),
  mockStreamComplete: vi.fn(),
}));

vi.mock('../../../utils/vector/hybrid-retriever.js', () => ({
  createHybridRetriever: () => ({
    retrieve: mockRetrieve,
  }),
}));

vi.mock('../../../utils/tokens/contextWindowAssembler.js', () => ({
  createContextWindowAssembler: () => ({
    assemble: mockAssemble,
    getBudget: mockGetBudget,
  }),
}));

vi.mock('../../../utils/tokens/tokenBudgetManager.js', () => ({
  createTokenBudgetManager: () => ({
    getTokenCount: mockGetTokenCount,
  }),
}));

vi.mock('../../../utils/ai/model-router.js', () => ({
  createModelRouter: () => ({
    getModel: mockGetModel,
  }),
}));

vi.mock('../../../utils/ai/anthropic-provider.js', () => ({
  createAnthropicProvider: () => ({
    complete: mockComplete,
  }),
}));

vi.mock('../../../utils/ai/streaming-provider.js', () => ({
  createStreamingProvider: () => ({
    streamComplete: mockStreamComplete,
  }),
}));

// Now import the functions to test
import { sendMessage, streamMessage } from '../chat.service.js';
import { Message } from '../../../utils/tokens/types.js';

describe('ChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRetrieve.mockResolvedValue([{ content: 'Doc content 1' }, { content: 'Doc content 2' }]);
    mockGetBudget.mockReturnValue({
      systemPrompt: 2000,
      toolDefinitions: 0,
      retrievedDocuments: 4000,
      conversationHistory: 8000,
      userMessage: 2000,
      responseBudget: 4000,
    });
    mockAssemble.mockReturnValue({
      systemPrompt: 'System Prompt',
      messages: [{ role: 'user', content: 'hello' }],
      totalTokens: 100,
      fittedDocuments: ['Doc content 1'],
      dropped: { historyMessagesDropped: 0, documentsSkipped: 0 },
    });
    mockGetTokenCount.mockReturnValue(10);
    mockGetModel.mockReturnValue({
      modelName: 'claude-haiku-4-5',
      inputCostPerMillion: 0.8,
      outputCostPerMillion: 4.0,
    });
    mockComplete.mockResolvedValue({
      text: 'Mocked response from Claude',
      usage: { inputTokens: 50, outputTokens: 25 },
    });
  });

  it('sendMessage retrieves chunks, formats context, and calls provider returning text and usage', async () => {
    const history: Message[] = [];
    const result = await sendMessage('hello', history, 'balanced');

    expect(mockRetrieve).toHaveBeenCalledWith('hello', { userId: undefined });
    expect(mockAssemble).toHaveBeenCalled();
    expect(mockGetModel).toHaveBeenCalledWith('chat', 'cheap');
    expect(mockComplete).toHaveBeenCalled();
    expect(result).toEqual({
      text: 'Mocked response from Claude',
      usage: { inputTokens: 50, outputTokens: 25 },
    });
  });

  it('streamMessage calls streaming provider with correct params', async () => {
    mockStreamComplete.mockImplementation(
      async (params: any, onChunk: (text: string) => void, onDone: (usage: any) => void) => {
        onChunk('Hello ');
        onChunk('world');
        onDone({ inputTokens: 30, outputTokens: 10 });
      },
    );

    const chunks: string[] = [];
    let finalUsage: any = null;

    await streamMessage(
      'test question',
      [],
      (chunk: string) => chunks.push(chunk),
      (usage: any) => {
        finalUsage = usage;
      },
      'fast',
    );

    expect(chunks).toEqual(['Hello ', 'world']);
    expect(finalUsage).toEqual({ inputTokens: 30, outputTokens: 10 });
    expect(mockStreamComplete).toHaveBeenCalledOnce();
  });
});
