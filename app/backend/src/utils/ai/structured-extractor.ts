import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

export interface StructuredExtractor {
  extract<T>(schema: z.ZodSchema<T>, systemPrompt: string, userInput: string): Promise<T>;
  extractWithRetry<T>(
    schema: z.ZodSchema<T>,
    systemPrompt: string,
    userInput: string,
    maxRetries?: number
  ): Promise<T>;
}

export function createStructuredExtractor(apiKey: string): StructuredExtractor {
  async function extract<T>(
    schema: z.ZodSchema<T>,
    systemPrompt: string,
    userInput: string
  ): Promise<T> {
    const llm = new ChatAnthropic({
      model: 'claude-haiku-4-5',
      apiKey,
      maxTokens: 4096,
    });

    const structured = llm.withStructuredOutput(schema);
    const msgs = [new SystemMessage(systemPrompt), new HumanMessage(userInput)];
    return structured.invoke(msgs) as Promise<T>;
  }

  async function extractWithRetry<T>(
    schema: z.ZodSchema<T>,
    systemPrompt: string,
    userInput: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await extract(schema, systemPrompt, userInput);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }

    throw new Error(
      `Failed to extract structured data after ${maxRetries} attempts. Last error: ${lastError.message}`
    );
  }

  return { extract, extractWithRetry };
}

export const TicketSchema = z.object({
  category: z.array(z.enum(['billing', 'technical', 'account', 'other'])).min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  summary: z.string().max(100),
  requiresHuman: z.boolean(),
});

export const ContactSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});
