import { vi, describe, it, expect } from 'vitest';
import * as repo from '../research.repository.js';

describe('Research Repository', () => {
  it('createSession inserts and returns a mapped session record', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'session-123',
        firm_id: 'firm-123',
        user_id: 'user-123',
        matter_id: null,
        title: 'Force Majeure',
        query: 'What is force majeure?',
        status: 'active',
        created_at: '2026-06-28T11:00:00.000Z',
        updated_at: '2026-06-28T11:00:00.000Z',
      },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    const mockSupabase: any = { from: mockFrom };

    const result = await repo.createSession(mockSupabase, {
      firmId: 'firm-123',
      userId: 'user-123',
      title: 'Force Majeure',
      query: 'What is force majeure?',
    });

    expect(mockFrom).toHaveBeenCalledWith('research_sessions');
    expect(mockInsert).toHaveBeenCalledWith({
      firm_id: 'firm-123',
      user_id: 'user-123',
      matter_id: null,
      title: 'Force Majeure',
      query: 'What is force majeure?',
    });
    expect(result.id).toBe('session-123');
    expect(result.title).toBe('Force Majeure');
  });

  it('getSessionsByFirm selects sessions matching firmId and orders by created_at', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'session-123',
          firm_id: 'firm-123',
          user_id: 'user-123',
          matter_id: null,
          title: 'Force Majeure',
          query: 'What is force majeure?',
          status: 'active',
          created_at: '2026-06-28T11:00:00.000Z',
          updated_at: '2026-06-28T11:00:00.000Z',
        }
      ],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase: any = { from: mockFrom };

    const result = await repo.getSessionsByFirm(mockSupabase, 'firm-123');

    expect(mockFrom).toHaveBeenCalledWith('research_sessions');
    expect(mockEq).toHaveBeenCalledWith('firm_id', 'firm-123');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('session-123');
  });

  it('getSessionById fetches a single session matching id and firmId', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'session-123',
        firm_id: 'firm-123',
        user_id: 'user-123',
        matter_id: null,
        title: 'Force Majeure',
        query: 'What is force majeure?',
        status: 'active',
        created_at: '2026-06-28T11:00:00.000Z',
        updated_at: '2026-06-28T11:00:00.000Z',
      },
      error: null,
    });
    const mockEqSecond = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqFirst = vi.fn().mockReturnValue({ eq: mockEqSecond });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqFirst });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockSupabase: any = { from: mockFrom };

    const result = await repo.getSessionById(mockSupabase, 'session-123', 'firm-123');

    expect(mockFrom).toHaveBeenCalledWith('research_sessions');
    expect(mockEqFirst).toHaveBeenCalledWith('id', 'session-123');
    expect(mockEqSecond).toHaveBeenCalledWith('firm_id', 'firm-123');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('session-123');
  });

  it('saveMessage inserts and returns a message without citations', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'msg-456',
        session_id: 'session-123',
        role: 'assistant',
        content: 'This is an answer.',
        created_at: '2026-06-28T11:05:00.000Z',
      },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    const mockSupabase: any = { from: mockFrom };

    const result = await repo.saveMessage(mockSupabase, {
      sessionId: 'session-123',
      role: 'assistant',
      content: 'This is an answer.',
    });

    expect(mockFrom).toHaveBeenCalledWith('research_messages');
    expect(mockInsert).toHaveBeenCalledWith({
      sessionId: 'session-123',
      role: 'assistant',
      content: 'This is an answer.',
    });
    expect(result.id).toBe('msg-456');
    expect(result.citations).toEqual([]);
  });

  it('saveCitations inserts multiple citations and maps them correctly', async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'cit-999',
          message_id: 'msg-456',
          session_id: 'session-123',
          source_document_id: 'doc-111',
          document_name: 'agreements.pdf',
          page_number: 12,
          chunk_preview: 'Lorem ipsum',
          relevance_score: 0.88,
          citation_index: 1,
          created_at: '2026-06-28T11:05:01.000Z',
        }
      ],
      error: null,
    });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    const mockSupabase: any = { from: mockFrom };

    const result = await repo.saveCitations(mockSupabase, [
      {
        messageId: 'msg-456',
        sessionId: 'session-123',
        sourceDocumentId: 'doc-111',
        documentName: 'agreements.pdf',
        pageNumber: 12,
        chunkPreview: 'Lorem ipsum',
        relevanceScore: 0.88,
        citationIndex: 1,
      }
    ]);

    expect(mockFrom).toHaveBeenCalledWith('research_citations');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cit-999');
    expect(result[0].documentName).toBe('agreements.pdf');
  });

  it('saveCitations returns empty array if no citations are passed', async () => {
    const mockSupabase: any = {};
    const result = await repo.saveCitations(mockSupabase, []);
    expect(result).toEqual([]);
  });
});
