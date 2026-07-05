import { SupabaseClient } from '@supabase/supabase-js';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';
import * as repo from './editor.repository.js';
import { exportDocument } from './editor.exporter.js';
import { SuggestionStreamChunk, RewriteTone, JSONContent } from './editor.types.js';
import { config } from '#config/index.js';
import { extractTextFromContent } from '../../utils/ai/langchain-helper.js';

/**
 * Stream AI inline suggestion based on preceding text.
 * Caller must handle AbortController cancellation.
 */
export async function* streamAiSuggestion(
  precedingText: string,
  documentTitle: string,
  signal: AbortSignal
): AsyncGenerator<SuggestionStreamChunk> {
  const prompt = `You are a legal document drafting assistant.
Complete the following legal document excerpt with 1-3 sentences that naturally continue
the thought. Be precise, use formal legal language, and match the existing tone.
Do not repeat what was already written. Output only the continuation text, nothing else.

Document title: ${documentTitle}

Text so far:
${precedingText.slice(-800)}`;   // last 800 chars for context

  try {
    const llm = new ChatAnthropic({
      modelName: 'claude-3-5-sonnet-20241022',
      apiKey: config.anthropicApiKey,
      maxTokens: 200,            // suggestions are short
      temperature: 0.2,
    });

    const stream = await llm.stream([new HumanMessage(prompt)], { signal });

    for await (const chunk of stream) {
      if (signal.aborted) {
        return;
      }
      const text = extractTextFromContent(chunk.content);
      if (text) {
        yield { type: 'text', text };
      }
    }

    yield { type: 'done' };
  } catch (err) {
    if (signal.aborted) return;
    console.error('AI suggestion error:', err);
    yield { type: 'error', error: 'Suggestion generation failed' };
  }
}

/**
 * Stream AI rewrite of selected text in a given tone.
 */
export async function* streamAiRewrite(
  selectedText: string,
  tone: RewriteTone,
  documentTitle: string,
  signal: AbortSignal
): AsyncGenerator<SuggestionStreamChunk> {
  const toneInstructions: Record<RewriteTone, string> = {
    formal:        'Use highly formal legal language with precise terminology.',
    simplified:    'Rewrite in plain English that a non-lawyer can understand.',
    aggressive:    'Use assertive, strong language that favours our client\'s position.',
    conciliatory:  'Use cooperative, flexible language that leaves room for negotiation.',
    neutral:       'Use balanced, objective language with no bias toward either party.',
  };

  const prompt = `You are a legal drafting assistant.
Rewrite the following legal text in a ${tone} tone.
${toneInstructions[tone]}
Preserve all legal meaning. Output only the rewritten text, nothing else.

Document title: ${documentTitle}

Original text:
${selectedText}`;

  try {
    const llm = new ChatAnthropic({
      modelName: 'claude-3-5-sonnet-20241022',
      apiKey: config.anthropicApiKey,
      maxTokens: 1000,
      temperature: 0.3,
    });

    const stream = await llm.stream([new HumanMessage(prompt)], { signal });

    for await (const chunk of stream) {
      if (signal.aborted) {
        return;
      }
      const text = extractTextFromContent(chunk.content);
      if (text) {
        yield { type: 'text', text };
      }
    }

    yield { type: 'done' };
  } catch (err) {
    if (signal.aborted) return;
    console.error('AI rewrite error:', err);
    yield { type: 'error', error: 'Rewrite failed' };
  }
}

/**
 * Auto-save document — called by debounced frontend trigger.
 * Also saves a version snapshot every 10 saves.
 */
export async function autoSaveDocument(
  supabase: SupabaseClient,
  params: {
    documentId: string;
    firmId: string;
    userId: string;
    content: JSONContent;
    wordCount: number;
    title?: string;
    version?: number;
  }
) {
  const updatedDoc = await repo.updateDocument(
    supabase,
    params.documentId,
    params.firmId,
    {
      content: params.content,
      wordCount: params.wordCount,
      title: params.title,
    },
    params.version
  );

  // Save a version snapshot every 10 auto-saves
  if (updatedDoc.saveCount > 0 && updatedDoc.saveCount % 10 === 0) {
    await repo.saveVersion(supabase, {
      documentId: params.documentId,
      firmId: params.firmId,
      userId: params.userId,
      content: params.content,
      wordCount: params.wordCount,
      label: `Auto-snapshot #${updatedDoc.saveCount}`,
    });
  }
}

export async function exportDocumentById(
  supabase: SupabaseClient,
  documentId: string,
  firmId: string,
  format: 'pdf' | 'docx'
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const doc = await repo.getDocumentById(supabase, documentId, firmId);
  if (!doc) throw new Error('Document not found');

  const buffer = await exportDocument(doc.title, doc.content, format);
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  const mimeType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return {
    buffer,
    filename: `${doc.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`,
    mimeType,
  };
}
