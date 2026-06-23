import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { CompletionParams } from './model-router.js';

export interface StreamingProvider {
  streamComplete(
    params: CompletionParams,
    onChunk: (text: string) => void,
    onDone: (usage: { inputTokens: number; outputTokens: number }) => void
  ): Promise<void>;
}

export function createStreamingProvider(apiKey: string): StreamingProvider {
  async function streamComplete(
    params: CompletionParams,
    onChunk: (text: string) => void,
    onDone: (usage: { inputTokens: number; outputTokens: number }) => void
  ): Promise<void> {
    const llm = new ChatAnthropic({
      model: params.model,
      apiKey,
      maxTokens: params.maxTokens ?? 4096,
      temperature: params.temperature,
      streaming: true,
    });

    const msgs = [];
    if (params.systemPrompt) msgs.push(new SystemMessage(params.systemPrompt));
    for (const m of params.messages) {
      if (m.role === 'user') msgs.push(new HumanMessage(m.content));
      else if (m.role === 'assistant') msgs.push(new AIMessage(m.content));
    }

    let inputTokens = 0;
    let outputTokens = 0;

    const stream = await llm.stream(msgs);

    for await (const chunk of stream) {
      const text =
        typeof chunk.content === 'string'
          ? chunk.content
          : chunk.content
              .filter((b) => b.type === 'text')
              .map((b: any) => b.text)
              .join('');

      if (text) onChunk(text);

      if (chunk.usage_metadata) {
        inputTokens = chunk.usage_metadata.input_tokens ?? inputTokens;
        outputTokens = chunk.usage_metadata.output_tokens ?? outputTokens;
      }
    }

    onDone({ inputTokens, outputTokens });
  }

  return { streamComplete };
}
