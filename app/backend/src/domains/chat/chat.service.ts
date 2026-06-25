import postgres from 'postgres';
import { HybridRetriever, createHybridRetriever } from '../../utils/vector/hybrid-retriever.js';
import { VectorStore, createVectorStore } from '../../utils/vectorStore/vectorStore.js';
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
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

const vectorStore = createVectorStore(db);
const embeddingService = createEmbeddingService('text-embedding-3-small');
const reranker = createReranker(process.env.COHERE_API_KEY);
const retriever = createHybridRetriever(vectorStore, embeddingService, reranker, db);

const tokenManager = createTokenBudgetManager(DEFAULT_CHAT_BUDGET);
const assembler = createContextWindowAssembler(DEFAULT_CHAT_BUDGET, tokenManager);
const modelRouter = createModelRouter();
const provider = createAnthropicProvider(process.env.ANTHROPIC_API_KEY);
const streaming = createStreamingProvider(process.env.ANTHROPIC_API_KEY);

// ---------------------------------------------------------------------------
// Shared context builder — single source of truth for retrieval + assembly.
// Both sendMessage and streamMessage call this; only the final LLM call differs.
// ---------------------------------------------------------------------------
interface BuiltContext {
  assembled: AssembledContext;
  finalSystemPrompt: string;
  modelName: string;
}

async function buildContext(
  message: string,
  history: Message[],
  tier: 'fast' | 'balanced' | 'powerful',
  userId?: string,
): Promise<BuiltContext> {
  // 1. Retrieve chunks most relevant to the query (vector + keyword + rerank),
  //    scoped to the requesting user's documents.
  const searchResults = await retriever.retrieve(message, { userId });
  const documents = searchResults.map((r) => r.content);

  // 2. Assemble context window — assembler owns token budget + document fitting.
  //    assembled.fittedDocuments contains only the docs that actually fit.
  const assembled = assembler.assemble(legalAiSystemPrompt, history, message, documents);

  // 3. Inject fitted docs into the system prompt placeholder.
  const sourcesText = assembled.fittedDocuments.join('\n\n---\n\n');
  const finalSystemPrompt = legalAiSystemPrompt.replace('{{sources}}', sourcesText);

  // 4. Resolve model from tier.
  const routerTier = mapTierToModelRouterTier(tier);
  const modelConfig = modelRouter.getModel('chat', routerTier);

  return { assembled, finalSystemPrompt, modelName: modelConfig.modelName };
}

export async function sendMessage(
  message: string,
  history: Message[],
  tier: 'fast' | 'balanced' | 'powerful' = 'balanced',
  userId?: string,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const { assembled, finalSystemPrompt, modelName } = await buildContext(
    message,
    history,
    tier,
    userId,
  );

  return provider.complete({
    model: modelName,
    messages: assembled.messages,
    systemPrompt: finalSystemPrompt,
  });
}

export async function streamMessage(
  message: string,
  history: Message[],
  onChunk: (text: string) => void,
  onDone: (usage: { inputTokens: number; outputTokens: number }) => void,
  tier: 'fast' | 'balanced' | 'powerful' = 'balanced',
  userId?: string,
): Promise<void> {
  const { assembled, finalSystemPrompt, modelName } = await buildContext(
    message,
    history,
    tier,
    userId,
  );

  await streaming.streamComplete(
    { model: modelName, messages: assembled.messages, systemPrompt: finalSystemPrompt },
    onChunk,
    onDone,
  );
}

export async function* streamMessageIterable(
  message: string,
  history: Message[],
  tier: 'fast' | 'balanced' | 'powerful' = 'balanced',
  userId?: string,
): AsyncGenerator<string | { data: any; event: string }, void, unknown> {
  const queue: Array<string | { data: any; event: string } | null> = [];
  let resolveNext: (() => void) | null = null;

  const push = (item: string | { data: any; event: string } | null) => {
    queue.push(item);
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  };

  // Trigger asynchronous message stream in the background
  streamMessage(
    message,
    history,
    (chunk) => push(chunk),
    (usage) => {
      push({ data: usage, event: 'done' });
      push(null);
    },
    tier,
    userId,
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
      break; // Stop generator cleanly
    }
    yield item;
  }
}
