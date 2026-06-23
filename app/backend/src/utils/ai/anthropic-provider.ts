import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ModelProvider, CompletionParams, CompletionResult } from './model-router.js';
import { EmbeddingService, createEmbeddingService } from '../embeddings/embeddingService.js';

export interface AnthropicProvider extends ModelProvider {}

export function createAnthropicProvider(apiKey: string): AnthropicProvider {
  const embeddingService: EmbeddingService = createEmbeddingService('text-embedding-3-small');

  function buildMessages(params: CompletionParams) {
    const msgs = [];
    if (params.systemPrompt) msgs.push(new SystemMessage(params.systemPrompt));
    for (const m of params.messages) {
      if (m.role === 'user') msgs.push(new HumanMessage(m.content));
      else if (m.role === 'assistant') msgs.push(new AIMessage(m.content));
    }
    return msgs;
  }

  async function complete(params: CompletionParams): Promise<CompletionResult> {
    const llm = new ChatAnthropic({
      model: params.model,
      apiKey,
      maxTokens: params.maxTokens ?? 4096,
      temperature: params.temperature,
    });

    const response = await llm.invoke(buildMessages(params));

    const text =
      typeof response.content === 'string'
        ? response.content
        : response.content
            .filter((b) => b.type === 'text')
            .map((b: any) => b.text)
            .join('');

    const usage = response.usage_metadata ?? { input_tokens: 0, output_tokens: 0 };

    return {
      text,
      usage: {
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
      },
    };
  }

  async function embed(text: string): Promise<number[]> {
    return embeddingService.embed(text);
  }

  return { complete, embed };
}
