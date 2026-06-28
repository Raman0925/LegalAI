import { vi, describe, it, expect, beforeEach } from 'vitest';

const {
  mockEmbedQuery,
  mockRerank,
  mockChatStream,
  mockSaveMessage,
  mockSaveCitations,
} = vi.hoisted(() => ({
  mockEmbedQuery: vi.fn(),
  mockRerank: vi.fn(),
  mockChatStream: vi.fn(),
  mockSaveMessage: vi.fn(),
  mockSaveCitations: vi.fn(),
}));

vi.mock('@langchain/openai', () => {
  return {
    OpenAIEmbeddings: vi.fn().mockImplementation(() => {
      return {
        embedQuery: mockEmbedQuery,
      };
    }),
  };
});

vi.mock('cohere-ai', () => {
  return {
    CohereClient: vi.fn().mockImplementation(() => {
      return {
        rerank: mockRerank,
        chatStream: mockChatStream,
      };
    }),
  };
});

vi.mock('../research.repository.js', () => {
  return {
    saveMessage: mockSaveMessage,
    saveCitations: mockSaveCitations,
  };
});

import { streamResearch } from '../research.service.js';

describe('Research Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streamResearch embeds query, calls hybrid_search_documents RPC, reranks, yields citations and text chunks, then saves result', async () => {
    mockSaveMessage.mockResolvedValue({ id: 'assistant-msg-123' });
    mockEmbedQuery.mockResolvedValue([0.1, 0.2]);

    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        {
          document_id: 'doc-1',
          document_name: 'doc.pdf',
          page_number: 5,
          content: 'This is context content.',
          similarity: 0.85,
        }
      ],
      error: null,
    });
    const mockSupabase: any = { rpc: mockRpc };

    mockRerank.mockResolvedValue({
      results: [
        {
          index: 0,
          relevanceScore: 0.95,
        }
      ],
    });

    // Mock stream iterator
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield { eventType: 'text-generation', text: 'Answer portion' };
      }
    };
    mockChatStream.mockResolvedValue(mockStream);

    const generator = streamResearch(mockSupabase, {
      sessionId: 'session-123',
      firmId: 'firm-123',
      userId: 'user-123',
      userQuery: 'What is force majeure?',
      conversationHistory: [],
      searchWeb: false,
    });

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    // Verify embeddings are called
    expect(mockEmbedQuery).toHaveBeenCalledWith('What is force majeure?');
    // Verify RPC is called
    expect(mockRpc).toHaveBeenCalledWith('hybrid_search_documents', {
      query_text: 'What is force majeure?',
      query_embedding: [0.1, 0.2],
      firm_id: 'firm-123',
      matter_id: null,
      match_count: 20,
    });
    // Verify rerank called
    expect(mockRerank).toHaveBeenCalled();
    // Verify stream chat called
    expect(mockChatStream).toHaveBeenCalled();
    // Verify saveMessage and saveCitations were called
    expect(mockSaveMessage).toHaveBeenCalledTimes(2); // one for user, one for assistant
    expect(mockSaveCitations).toHaveBeenCalled();

    // Verify generator output
    expect(chunks).toContainEqual({
      type: 'citation',
      citation: {
        messageId: '',
        sessionId: 'session-123',
        sourceDocumentId: 'doc-1',
        documentName: 'doc.pdf',
        pageNumber: 5,
        chunkPreview: 'This is context content.',
        relevanceScore: 0.95,
        citationIndex: 1,
      }
    });
    expect(chunks).toContainEqual({
      type: 'text',
      text: 'Answer portion',
    });
    expect(chunks).toContainEqual({
      type: 'done',
    });
  });

  it('streamResearch yields error chunk if embedding fails', async () => {
    mockSaveMessage.mockResolvedValue({ id: 'user-msg-123' });
    mockEmbedQuery.mockRejectedValue(new Error('Embedding failed'));

    const mockSupabase: any = {};
    const generator = streamResearch(mockSupabase, {
      sessionId: 'session-123',
      firmId: 'firm-123',
      userId: 'user-123',
      userQuery: 'What is force majeure?',
      conversationHistory: [],
      searchWeb: false,
    });

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toContainEqual({
      type: 'error',
      error: 'Failed to embed query',
    });
  });
});
