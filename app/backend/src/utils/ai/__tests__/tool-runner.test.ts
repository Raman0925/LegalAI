import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createToolRunner, ToolHandler } from '../tool-runner.js';
import { ChatAnthropic } from '@langchain/anthropic';

const getOrderStatus: ToolHandler<
  { orderId: string },
  { orderId: string; status: string; eta: string }
> = {
  definition: {
    name: 'getOrderStatus',
    description: 'Look up the status and estimated arrival date of an order by its ID.',
    input_schema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'The unique ID of the order.',
        },
      },
      required: ['orderId'],
    },
  },
  handler: async (input) => {
    return { orderId: input.orderId, status: 'shipped', eta: '2024-01-15' };
  },
};

const getCustomerAccount: ToolHandler<
  { email: string },
  { email: string; plan: string; since: string }
> = {
  definition: {
    name: 'getCustomerAccount',
    description: 'Get information about a customer account using their email address.',
    input_schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'The email address of the customer.',
        },
      },
      required: ['email'],
    },
  },
  handler: async (input) => {
    return { email: input.email, plan: 'pro', since: '2023-01-01' };
  },
};


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

describe('ToolRunner', () => {
  const apiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDefinitions returns all registered tool definitions', () => {
    const runner = createToolRunner();
    runner.register(getOrderStatus);
    runner.register(getCustomerAccount);

    const definitions = runner.getDefinitions();
    expect(definitions).toHaveLength(2);
    expect(definitions[0].name).toBe('getOrderStatus');
    expect(definitions[1].name).toBe('getCustomerAccount');
  });

  it('Tool loop executes tool and sends result back to model', async () => {
    const runner = createToolRunner();
    runner.register(getOrderStatus);

    const mockInvoke = vi
      .fn()
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          {
            name: 'getOrderStatus',
            args: { orderId: 'ORD-999' },
            id: 'toolu_1',
          },
        ],
      })
      .mockResolvedValueOnce({
        content: 'Your order ORD-999 is shipped and will arrive on 2024-01-15.',
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

    const messages = [{ role: 'user', content: 'What is the status of order ORD-999?' } as const];

    const { result, toolCallCount } = await runner.run(messages, apiKey);

    expect(result).toBe('Your order ORD-999 is shipped and will arrive on 2024-01-15.');
    expect(toolCallCount).toBe(1);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('Tool loop throws after MAX_ITERATIONS', async () => {
    const runner = createToolRunner();
    runner.register(getOrderStatus);

    const mockInvoke = vi.fn().mockResolvedValue({
      content: '',
      tool_calls: [
        {
          name: 'getOrderStatus',
          args: { orderId: 'ORD-123' },
          id: 'toolu_infinite',
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

    const messages = [{ role: 'user', content: 'Check status' } as const];

    await expect(runner.run(messages, apiKey)).rejects.toThrowError(
      /Exceeded maximum tool execution iterations/,
    );

    expect(mockInvoke).toHaveBeenCalledTimes(10);
  });
});
