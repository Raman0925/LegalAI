import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import authMiddleware from './auth.middleware.js';
import jwt from 'jsonwebtoken';

describe('authMiddleware', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    vi.restoreAllMocks();
  });

  it('should bypass auth for /health, /docs, and /favicon.ico', async () => {
    const reply: any = {};

    // Test health
    const reqHealth: any = { url: '/health' };
    await expect(authMiddleware(reqHealth, reply)).resolves.toBeUndefined();

    // Test docs
    const reqDocs: any = { url: '/docs/index.html' };
    await expect(authMiddleware(reqDocs, reply)).resolves.toBeUndefined();

    // Test favicon
    const reqFavicon: any = { url: '/favicon.ico' };
    await expect(authMiddleware(reqFavicon, reply)).resolves.toBeUndefined();
  });

  it('should throw 401 if Authorization header is missing', async () => {
    const req: any = {
      url: '/auth/me',
      headers: {},
    };
    const reply: any = {};

    await expect(authMiddleware(req, reply)).rejects.toThrow(
      'Unauthorized: Missing or invalid token format',
    );
  });

  it('should throw 401 if Authorization header is not Bearer', async () => {
    const req: any = {
      url: '/auth/me',
      headers: {
        authorization: 'Basic abc',
      },
    };
    const reply: any = {};

    await expect(authMiddleware(req, reply)).rejects.toThrow(
      'Unauthorized: Missing or invalid token format',
    );
  });

  it('should throw 401 if token verification fails', async () => {
    const req: any = {
      url: '/auth/me',
      headers: {
        authorization: 'Bearer invalid-token-sig',
      },
    };
    const reply: any = {};

    await expect(authMiddleware(req, reply)).rejects.toThrow(
      'Unauthorized: Invalid or expired access token',
    );
  });

  it('should verify token, query database and attach profile to request.user if profile exists', async () => {
    const payload = {
      sub: 'user-id-123',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.png',
      },
    };
    const token = 'mocked-jwt-token';
    vi.spyOn(jwt, 'verify').mockReturnValue(payload as any);

    const mockProfile = {
      id: 'user-id-123',
      email: 'test@example.com',
      full_name: 'John Doe',
      avatar_url: 'https://example.com/avatar.png',
      firm_id: 'firm-id-123',
      role: 'owner',
      created_at: '2026-06-14T08:00:00Z',
      updated_at: '2026-06-14T08:00:00Z',
    };

    const mockQuery = vi.fn().mockResolvedValue({
      rows: [mockProfile],
    });

    const req: any = {
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
      server: {
        pg: {
          query: mockQuery,
        },
      },
      log: {
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
      },
    };
    const reply: any = {};

    await authMiddleware(req, reply);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('firm_id, role'),
      ['user-id-123'],
    );
    expect(req.user).toEqual({
      id: mockProfile.id,
      email: mockProfile.email,
      full_name: mockProfile.full_name,
      avatar_url: mockProfile.avatar_url,
      firmId: mockProfile.firm_id,
      role: mockProfile.role,
      created_at: mockProfile.created_at,
      updated_at: mockProfile.updated_at,
    });
  });

  it('should use fallback metadata when profile is not found in database', async () => {
    const payload = {
      sub: 'user-id-456',
      email: 'fallback@example.com',
      user_metadata: {
        full_name: 'Fallback User',
        avatar_url: null,
      },
    };
    const token = 'mocked-jwt-token';
    vi.spyOn(jwt, 'verify').mockReturnValue(payload as any);

    const mockQuery = vi.fn().mockResolvedValue({
      rows: [], // empty rows -> profile not found
    });

    const mockWarn = vi.fn();
    const req: any = {
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
      server: {
        pg: {
          query: mockQuery,
        },
      },
      log: {
        warn: mockWarn,
        debug: vi.fn(),
        error: vi.fn(),
      },
    };
    const reply: any = {};

    await authMiddleware(req, reply);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('firm_id, role'),
      ['user-id-456'],
    );
    expect(req.user.id).toBe('user-id-456');
    expect(req.user.email).toBe('fallback@example.com');
    expect(req.user.full_name).toBe('Fallback User');
    expect(req.user.avatar_url).toBeNull();
    expect(req.user.firmId).toBe('');
    expect(req.user.role).toBe('member');
    expect(req.user.created_at).toBeDefined();
    expect(req.user.updated_at).toBeDefined();
    expect(mockWarn).toHaveBeenCalled();
  });
});
