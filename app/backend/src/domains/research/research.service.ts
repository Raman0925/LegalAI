import { SupabaseClient } from '@supabase/supabase-js';
import { CohereClient } from 'cohere-ai';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as repo from './research.repository.js';
import { ResearchCitation, ResearchStreamChunk } from './research.types.js';
import { config } from '#config/index.js';

const cohere = new CohereClient({ token: config.cohereApiKey });
const embeddings = new OpenAIEmbeddings({ openAIApiKey: config.openaiApiKey });

/**
 * Core research function — retrieves chunks, reranks, streams response with citations.
 * Yields ResearchStreamChunk objects for SSE.
 */
export async function* streamResearch(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    firmId: string;
    userId: string;
    matterId?: string;
    userQuery: string;
    conversationHistory: { role: 'user' | 'assistant'; content: string }[];
    searchWeb: boolean;
  }
): AsyncGenerator<ResearchStreamChunk> {
  // 1. Save user message
  let userMsg;
  try {
    userMsg = await repo.saveMessage(supabase, {
      sessionId: params.sessionId,
      role: 'user',
      content: params.userQuery,
    });
  } catch (err) {
    yield { type: 'error', error: 'Failed to save user message' };
    return;
  }

  // 2. Embed the query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embeddings.embedQuery(params.userQuery);
  } catch {
    yield { type: 'error', error: 'Failed to embed query' };
    return;
  }

  // 3. Hybrid search — vector + keyword via pgvector RRF
  const { data: chunks, error: searchError } = await supabase.rpc(
    'hybrid_search_documents',
    {
      query_text: params.userQuery,
      query_embedding: queryEmbedding,
      firm_id: params.firmId,
      matter_id: params.matterId ?? null,
      match_count: 20,
    }
  );

  if (searchError || !chunks) {
    yield { type: 'error', error: 'Document search failed' };
    return;
  }

  // 4. Cohere reranking
  let rerankedChunks: any[] = chunks;
  if (chunks.length > 0) {
    try {
      const reranked = await cohere.rerank({
        model: 'rerank-english-v3.0',
        query: params.userQuery,
        documents: chunks.map((c: { content: string }) => c.content),
        topN: 8,
      });

      rerankedChunks = reranked.results.map(r => ({
        ...chunks[r.index],
        relevanceScore: r.relevanceScore,
      }));
    } catch {
      // Rerank failed — fall back to vector scores, don't abort
      rerankedChunks = chunks.slice(0, 8);
    }
  }

  // 5. Build citation objects (before streaming so indices are known)
  const pendingCitations: Omit<ResearchCitation, 'id' | 'createdAt'>[] = rerankedChunks
    .map((chunk: {
      document_id: string;
      document_name: string;
      page_number: number | null;
      content: string;
      relevanceScore?: number;
      similarity?: number;
    }, idx: number) => ({
      messageId: '',              // filled after assistant message saved
      sessionId: params.sessionId,
      sourceDocumentId: chunk.document_id ?? null,
      documentName: chunk.document_name,
      pageNumber: chunk.page_number ?? null,
      chunkPreview: chunk.content.slice(0, 300),
      relevanceScore: chunk.relevanceScore ?? chunk.similarity ?? 0,
      citationIndex: idx + 1,
    }));

  // 6. Stream citations to frontend first so UI can render sidebar
  for (const citation of pendingCitations) {
    yield { type: 'citation', citation: citation as ResearchCitation };
  }

  // 7. Build context for LLM
  const context = rerankedChunks
    .map((c: { content: string }, i: number) => `[${i + 1}] ${c.content}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a legal research assistant for a law firm. 
Answer the lawyer's question using ONLY the provided context documents.
When you reference information, cite it inline using [1], [2], [3] etc. matching the source numbers.
If the context does not contain enough information, say so clearly — do not speculate.
Be precise, professional, and cite every material claim.

Context Documents:
${context}`;

  // 8. Stream LLM response
  let fullResponse = '';
  try {
    const stream = await cohere.chatStream({
      model: 'command-r-plus',
      message: params.userQuery,
      chatHistory: params.conversationHistory.map(m => ({
        role: m.role === 'user' ? 'USER' : 'CHATBOT',
        message: m.content,
      })),
      preamble: systemPrompt,
    });

    for await (const event of stream) {
      if (event.eventType === 'text-generation') {
        fullResponse += event.text;
        yield { type: 'text', text: event.text };
      }
    }
  } catch {
    yield { type: 'error', error: 'AI generation failed' };
    return;
  }

  // 9. Save assistant message + citations
  try {
    const assistantMsg = await repo.saveMessage(supabase, {
      sessionId: params.sessionId,
      role: 'assistant',
      content: fullResponse,
    });

    const citationsWithMsgId = pendingCitations.map(c => ({
      ...c,
      messageId: assistantMsg.id,
    }));

    await repo.saveCitations(supabase, citationsWithMsgId);
  } catch {
    // Non-fatal — response already streamed
    console.error('Failed to persist research message/citations');
  }

  yield { type: 'done' };
}
