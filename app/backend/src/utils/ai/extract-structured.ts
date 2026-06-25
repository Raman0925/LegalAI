import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ToolDefinition } from './tool-runner.js';

export async function extractStructured<T>(
  input: string,
  toolDefinition: ToolDefinition,
  apiKey: string,
  model: string = 'claude-haiku-4-5',
): Promise<T> {
  const lcTool = tool(async (args: Record<string, unknown>) => JSON.stringify(args), {
    name: toolDefinition.name,
    description: toolDefinition.description,
    schema: z.object({}),
  });

  const llm = new ChatAnthropic({ model, apiKey, maxTokens: 4096 }).bindTools([lcTool], {
    tool_choice: { type: 'tool', name: toolDefinition.name },
  });

  const response = await llm.invoke([new HumanMessage(input)]);

  const tc = response.tool_calls?.[0];
  if (!tc) {
    throw new Error(`Model did not call the expected tool: ${toolDefinition.name}`);
  }

  return tc.args as T;
}

export const extractShippingAddress: ToolDefinition = {
  name: 'extractShippingAddress',
  description: 'Extract shipping address information from unstructured text.',
  input_schema: {
    type: 'object',
    properties: {
      fullName: { type: 'string', description: 'The full name of the recipient.' },
      streetAddress: { type: 'string', description: 'The street address.' },
      city: { type: 'string', description: 'The city name.' },
      country: { type: 'string', description: 'The country name.' },
      postalCode: { type: 'string', description: 'The postal code or ZIP code.' },
    },
    required: ['fullName', 'streetAddress', 'city', 'country'],
  },
};
