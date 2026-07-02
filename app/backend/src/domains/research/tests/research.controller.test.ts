import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { researchController } from '../research.controller.js';

vi.mock('#middlewares/auth.middleware.js', () => {
  return {
    default: vi.fn().mockImplementation(async (request: any, reply: any) => {
      request.user = {
        id: 'user-123',
        firmId: 'firm-123',
        email: 'a@b.com',
        full_name: 'John Doe',
        avatar_url: null,
        created_at: '2026-06-28T11:00:00.000Z',
        updated_at: '2026-06-28T11:00:00.000Z',
      };
    }),
  };
});

vi.mock('../research.repository.js', () => {
  return {
    createSession: vi.fn().mockResolvedValue({
      id: 'session-123',
      firmId: 'firm-123',
      userId: 'user-123',
      matterId: null,
      title: 'Force Majeure',
      query: 'What is force majeure?',
      status: 'active',
      createdAt: '2026-06-28T11:00:00.000Z',
      updatedAt: '2026-06-28T11:00:00.000Z',
    }),
    getSessionsByFirm: vi.fn().mockResolvedValue([
      {
        id: 'session-123',
        firmId: 'firm-123',
        userId: 'user-123',
        matterId: null,
        title: 'Force Majeure',
        query: 'What is force majeure?',
        status: 'active',
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T11:00:00.000Z',
      }
    ]),
    getSessionById: vi.fn().mockResolvedValue({
      id: 'session-123',
      firmId: 'firm-123',
      userId: 'user-123',
      matterId: null,
      title: 'Force Majeure',
      query: 'What is force majeure?',
      status: 'active',
      createdAt: '2026-06-28T11:00:00.000Z',
      updatedAt: '2026-06-28T11:00:00.000Z',
    }),
    getMessagesBySession: vi.fn().mockResolvedValue([
      {
        id: 'msg-123',
        sessionId: 'session-123',
        role: 'user',
        content: 'What is force majeure?',
        citations: [],
        createdAt: '2026-06-28T11:00:00.000Z',
      }
    ]),
  };
});

vi.mock('../research.service.js', () => {
  return {
    streamResearch: vi.fn().mockImplementation(async function* () {
      yield { type: 'citation', citation: { citationIndex: 1, documentName: 'doc.pdf', chunkPreview: 'text', relevanceScore: 0.9 } };
      yield { type: 'text', text: 'Force majeure is...' };
      yield { type: 'done' };
    }),
  };
});

vi.mock('#middlewares/plan-limits.middleware.js', () => ({
  planLimit: vi.fn().mockReturnValue(async () => {}),
}));

vi.mock('#middlewares/usage-tracker.middleware.js', () => ({
  trackAfterResponse: vi.fn().mockReturnValue(async () => {}),
}));

describe('Research Controller', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify();
    app.decorate('supabase', {}); // mock supabase client
    app.register(researchController);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /research/sessions returns 201 on success', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/research/sessions',
      payload: {
        title: 'Force Majeure',
        query: 'What is force majeure?',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.session.title).toBe('Force Majeure');
  });

  it('GET /research/sessions returns sessions list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/research/sessions',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.sessions).toHaveLength(1);
  });

  it('GET /research/sessions/:sessionId returns session details and messages', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/research/sessions/00000000-0000-0000-0000-000000000000',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.session.id).toBe('session-123');
    expect(body.messages).toHaveLength(1);
  });

  it('POST /research/sessions/:sessionId/stream streams response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/research/sessions/00000000-0000-0000-0000-000000000000/stream',
      payload: {
        content: 'test follow up',
      },
    });

    expect(response.statusCode).toBe(200);
    const lines = response.payload.split('\n');
    expect(lines).toContain('data: {"type":"citation","citation":{"citationIndex":1,"documentName":"doc.pdf","chunkPreview":"text","relevanceScore":0.9}}');
    expect(lines).toContain('data: {"type":"text","text":"Force majeure is..."}');
    expect(lines).toContain('data: {"type":"done"}');
  });
});
