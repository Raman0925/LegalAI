import { vi, describe, it, expect, beforeEach } from 'vitest';
import { extractStructured, extractShippingAddress } from '../extract-structured.js';
import { ChatAnthropic } from '@langchain/anthropic';

vi.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: vi.fn().mockImplementation(() => {
      return {
        bindTools: vi.fn().mockReturnValue({
          invoke: vi.fn(),
        }),
      };
    }),
  };
});

describe('extractStructured', () => {
  const apiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extractStructured returns the tool input when model calls the tool', async () => {
    const mockAddress = {
      fullName: 'John Doe',
      streetAddress: '1600 Amphitheatre Pkwy',
      city: 'Mountain View',
      country: 'USA',
      postalCode: '94043',
    };

    const mockInvoke = vi.fn().mockResolvedValue({
      tool_calls: [
        {
          name: 'extractShippingAddress',
          args: mockAddress,
          id: 'toolu_addr_1',
        },
      ],
    });

    const mockBindTools = vi.fn().mockReturnValue({
      invoke: mockInvoke,
    });

    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        bindTools: mockBindTools,
      } as any;
    });

    const result = await extractStructured(
      'Deliver to John Doe at 1600 Amphitheatre Pkwy, Mountain View, USA, ZIP 94043',
      extractShippingAddress,
      apiKey,
    );

    expect(result).toEqual(mockAddress);
    expect(mockBindTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        tool_choice: { type: 'tool', name: 'extractShippingAddress' },
      }),
    );
  });

  it("extractStructured throws when model doesn't call the expected tool", async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      tool_calls: [],
    });

    const mockBindTools = vi.fn().mockReturnValue({
      invoke: mockInvoke,
    });

    vi.mocked(ChatAnthropic).mockImplementation(() => {
      return {
        bindTools: mockBindTools,
      } as any;
    });

    await expect(
      extractStructured('Hello there!', extractShippingAddress, apiKey),
    ).rejects.toThrowError(/Model did not call the expected tool: extractShippingAddress/);
  });
});
