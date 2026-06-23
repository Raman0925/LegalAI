import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, BaseMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolHandler<TInput = any, TOutput = any> {
  definition: ToolDefinition;
  handler: (input: TInput) => Promise<TOutput>;
}

export interface ToolRunner {
  register(tool: ToolHandler): void;
  getDefinitions(): ToolDefinition[];
  run(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    apiKey: string
  ): Promise<{ result: string; toolCallCount: number }>;
}

export function createToolRunner(): ToolRunner {
  const registry = new Map<string, ToolHandler>();
  const MAX_ITERATIONS = 10;

  function register(t: ToolHandler): void {
    registry.set(t.definition.name, t);
  }

  function getDefinitions(): ToolDefinition[] {
    return Array.from(registry.values()).map((t) => t.definition);
  }

  async function run(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    apiKey: string
  ): Promise<{ result: string; toolCallCount: number }> {
    const lcTools = Array.from(registry.values()).map((t) =>
      tool(
        async (input: Record<string, unknown>) => {
          const output = await t.handler(input);
          return JSON.stringify(output);
        },
        {
          name: t.definition.name,
          description: t.definition.description,
          schema: z.object({}),
        }
      )
    );

    const llm = new ChatAnthropic({
      model: 'claude-haiku-4-5',
      apiKey,
      maxTokens: 4096,
    }).bindTools(lcTools);

    const history: BaseMessage[] = messages.map((m) => {
      if (m.role === 'system') return new SystemMessage(m.content);
      if (m.role === 'assistant') return new AIMessage(m.content);
      return new HumanMessage(m.content);
    });

    let toolCallCount = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await llm.invoke(history);
      history.push(response);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        const text =
          typeof response.content === 'string'
            ? response.content
            : response.content
                .filter((b) => b.type === 'text')
                .map((b: any) => b.text)
                .join('');
        return { result: text, toolCallCount };
      }

      for (const tc of response.tool_calls) {
        const handler = registry.get(tc.name);
        let resultContent: string;

        if (!handler) {
          resultContent = JSON.stringify({ error: `Tool ${tc.name} not found` });
        } else {
          try {
            const output = await handler.handler(tc.args);
            resultContent = JSON.stringify(output);
          } catch (err) {
            resultContent = JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        history.push(new ToolMessage({ content: resultContent, tool_call_id: tc.id ?? '' }));
        toolCallCount++;
      }
    }

    throw new Error(`Exceeded maximum tool execution iterations of ${MAX_ITERATIONS}`);
  }

  return { register, getDefinitions, run };
}
