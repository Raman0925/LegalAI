import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createStructuredExtractor, TicketSchema, ContactSchema } from '../structured-extractor.js';
import { ChatAnthropic } from '@langchain/anthropic';

vi.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: vi.fn().mockImplementation(() => {
      return {
        withStructuredOutput: vi.fn().mockReturnValue({
          invoke: vi.fn(),
        }),
      };
    }),
  };
});

describe('StructuredExtractor', () => {
  const apiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extract returns correct shape for valid model output', async () => {
    const mockOutput = {
      category: ['technical'],
      priority: 'high',
      summary: 'Cannot connect to database',
      requiresHuman: true,
    };

    const mockInvoke = vi.fn().mockResolvedValue(mockOutput);
    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        withStructuredOutput: vi.fn().mockReturnValue({
          invoke: mockInvoke,
        }),
      } as any;
    });

    const extractor = createStructuredExtractor(apiKey);
    const result = await extractor.extract(
      TicketSchema,
      'Classify the support ticket.',
      'Help, I cannot connect to my Postgres database!'
    );

    expect(result).toEqual(mockOutput);
    expect(ChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5',
        apiKey: apiKey,
      })
    );
    expect(mockInvoke).toHaveBeenCalled();
  });

  it('extract throws when execution fails', async () => {
    const mockInvoke = vi.fn().mockRejectedValue(new Error('API Error'));
    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        withStructuredOutput: vi.fn().mockReturnValue({
          invoke: mockInvoke,
        }),
      } as any;
    });

    const extractor = createStructuredExtractor(apiKey);
    await expect(
      extractor.extract(TicketSchema, 'Classify the support ticket.', 'Hello!')
    ).rejects.toThrowError('API Error');
  });

  it('extractWithRetry retries on failure', async () => {
    const mockOutput = {
      category: ['billing'],
      priority: 'low',
      summary: 'Billing question',
      requiresHuman: false,
    };

    const mockInvoke = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary Network Error'))
      .mockResolvedValueOnce(mockOutput);

    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        withStructuredOutput: vi.fn().mockReturnValue({
          invoke: mockInvoke,
        }),
      } as any;
    });

    const extractor = createStructuredExtractor(apiKey);
    const result = await extractor.extractWithRetry(
      TicketSchema,
      'Classify the support ticket.',
      'How do I view my invoice?'
    );

    expect(result).toEqual(mockOutput);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('extract extracts contact information correctly', async () => {
    const mockOutput = {
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Inc',
    };

    const mockInvoke = vi.fn().mockResolvedValue(mockOutput);
    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        withStructuredOutput: vi.fn().mockReturnValue({
          invoke: mockInvoke,
        }),
      } as any;
    });

    const extractor = createStructuredExtractor(apiKey);
    const result = await extractor.extract(
      ContactSchema,
      'Extract contact information.',
      'My name is John Doe, reach me at john@example.com. I work at Acme Inc.'
    );

    expect(result).toEqual(mockOutput);
  });
});
