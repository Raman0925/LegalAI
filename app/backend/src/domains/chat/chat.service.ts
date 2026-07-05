import postgres from 'postgres';
import { HybridRetriever, createHybridRetriever } from '../../utils/vector/hybrid-retriever.js';
import {
  EmbeddingService,
  createEmbeddingService,
} from '../../utils/embeddings/embeddingService.js';
import { Reranker, createReranker } from '../../utils/vector/reranker.js';
import {
  ContextWindowAssembler,
  createContextWindowAssembler,
} from '../../utils/tokens/contextWindowAssembler.js';
import {
  TokenBudgetManager,
  createTokenBudgetManager,
} from '../../utils/tokens/tokenBudgetManager.js';
import { ModelRouter, createModelRouter } from '../../utils/ai/model-router.js';
import { AnthropicProvider, createAnthropicProvider } from '../../utils/ai/anthropic-provider.js';
import { StreamingProvider, createStreamingProvider } from '../../utils/ai/streaming-provider.js';
import { Message, AssembledContext } from '../../utils/tokens/types.js';
import { legalAiSystemPrompt } from '../../utils/prompts/prompt-manager.js';
import { DEFAULT_CHAT_BUDGET } from './chat.constant.js';
import { mapTierToModelRouterTier } from './chat.util.js';
import * as repo from './chat.repository.js';

// Fail fast at startup — don't let a missing key surface as a 401 mid-query.
if (!process.env.COHERE_API_KEY) {
  throw new Error('COHERE_API_KEY environment variable is required but not set.');
}
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required but not set.');
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required but not set.');
}

// Global Singleton Initialization for exported domain functions
const db = postgres(process.env.DATABASE_URL || '', {
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' },
});

const embeddingService = createEmbeddingService('text-embedding-3-small');
const reranker = createReranker(process.env.COHERE_API_KEY);
const retriever = createHybridRetriever(embeddingService, reranker, db);

const tokenManager = createTokenBudgetManager(DEFAULT_CHAT_BUDGET);
const assembler = createContextWindowAssembler(DEFAULT_CHAT_BUDGET, tokenManager);
const modelRouter = createModelRouter();
const provider = createAnthropicProvider(process.env.ANTHROPIC_API_KEY);
const streaming = createStreamingProvider(process.env.ANTHROPIC_API_KEY);

interface BuiltContext {
  assembled: AssembledContext;
  finalSystemPrompt: string;
  modelName: string;
}

async function buildContext(
  message: string,
  history: Message[],
  tier: 'fast' | 'balanced' | 'powerful',
  userId: string,
  firmId: string,
): Promise<BuiltContext> {
  // 1. Retrieve chunks most relevant to the query, scoped to firm and user
  const searchResults = await retriever.retrieve(message, userId, firmId);
  const documents = searchResults.map((r) => r.content);

  // 2. Assemble context window
  const assembled = assembler.assemble(legalAiSystemPrompt, history, message, documents);

  // 3. Inject fitted docs
  const sourcesText = assembled.fittedDocuments.join('\n\n---\n\n');
  const finalSystemPrompt = legalAiSystemPrompt.replace('{{sources}}', sourcesText);

  // 4. Resolve model
  const routerTier = mapTierToModelRouterTier(tier);
  const modelConfig = modelRouter.getModel('chat', routerTier);

  return { assembled, finalSystemPrompt, modelName: modelConfig.modelName };
}

export async function sendMessage(
  supabase: any,
  message: string,
  tier: 'fast' | 'balanced' | 'powerful' = 'balanced',
  userId: string,
  firmId: string,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const sessionId = await repo.getOrCreateActiveSession(supabase, firmId, userId);
  await repo.saveMessage(supabase, sessionId, 'user', message);
  const dbMessages = await repo.getMessages(supabase, sessionId, firmId);
  const history = dbMessages.slice(0, -1);

  const { assembled, finalSystemPrompt, modelName } = await buildContext(
    message,
    history,
    tier,
    userId,
    firmId,
  );

  const response = await provider.complete({
    model: modelName,
    messages: assembled.messages,
    systemPrompt: finalSystemPrompt,
  });

  await repo.saveMessage(supabase, sessionId, 'assistant', response.text);
  return response;
}

export async function streamMessage(
  message: string,
  history: Message[],
  onChunk: (text: string) => void,
  onDone: (usage: { inputTokens: number; outputTokens: number }) => void,
  tier: 'fast' | 'balanced' | 'powerful' = 'balanced',
  userId: string,
  firmId: string,
): Promise<void> {
  const { assembled, finalSystemPrompt, modelName } = await buildContext(
    message,
    history,
    tier,
    userId,
    firmId,
  );

  await streaming.streamComplete(
    { model: modelName, messages: assembled.messages, systemPrompt: finalSystemPrompt },
    onChunk,
    onDone,
  );
}

export async function* streamMessageIterable(
  supabase: any,
  message: string,
  tier: 'fast' | 'balanced' | 'powerful' = 'balanced',
  userId: string,
  firmId: string,
): AsyncGenerator<string | { data: any; event: string }, void, unknown> {
  const sessionId = await repo.getOrCreateActiveSession(supabase, firmId, userId);
  await repo.saveMessage(supabase, sessionId, 'user', message);
  const dbMessages = await repo.getMessages(supabase, sessionId, firmId);
  const history = dbMessages.slice(0, -1);

  let fullAssistantResponse = '';
  const queue: Array<string | { data: any; event: string } | null> = [];
  let resolveNext: (() => void) | null = null;

  const push = (item: string | { data: any; event: string } | null) => {
    queue.push(item);
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  };

  // Trigger stream completion in background
  streamMessage(
    message,
    history,
    (chunk) => {
      fullAssistantResponse += chunk;
      push(chunk);
    },
    (usage) => {
      repo.saveMessage(supabase, sessionId, 'assistant', fullAssistantResponse).catch((err) => {
        console.error('Failed to save assistant message:', err);
      });
      push({ data: usage, event: 'done' });
      push(null);
    },
    tier,
    userId,
    firmId,
  ).catch((err) => {
    push({ data: JSON.stringify({ error: err.message }), event: 'error' });
    push(null);
  });

  while (true) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
    }
    const item = queue.shift();
    if (item === null || item === undefined) {
      break;
    }
    yield item;
  }
}
