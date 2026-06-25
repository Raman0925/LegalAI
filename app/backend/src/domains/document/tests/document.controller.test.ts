import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import documentController from '../document.controller.js';

const { mockUpload, mockList, mockGetById, mockGetStatus, mockRemove } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockList: vi.fn(),
  mockGetById: vi.fn(),
  mockGetStatus: vi.fn(),
  mockRemove: vi.fn(),
}));

vi.mock('../document.service.js', () => ({
  createDocumentService: () => ({
    upload: mockUpload,
    list: mockList,
    getById: mockGetById,
    getStatus: mockGetStatus,
    remove: mockRemove,
  }),
}));

function buildMultipartPayload(filename: string, content: string, boundary: string): string {
  return [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: text/plain',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

describe('Document Controller Routes', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.decorate('pg', {});
    app.addHook('onRequest', async (request: any) => {
      request.user = {
        id: 'user-1',
        email: 'a@b.com',
        full_name: null,
        avatar_url: null,
        created_at: '',
        updated_at: '',
      };
    });
    app.register(multipart);
    app.register(documentController);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /upload returns 202 with documentId and status on success', async () => {
    mockUpload.mockResolvedValue({ documentId: 'doc-1', status: 'pending' });
    const boundary = '----testboundary';

    const response = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: buildMultipartPayload('contract.txt', 'hello world', boundary),
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.payload)).toEqual({ documentId: 'doc-1', status: 'pending' });
    expect(mockUpload).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        filename: 'contract.txt',
        mimetype: 'text/plain',
      }),
      expect.any(Object),
    );
  });

  it('POST /upload returns 400 when no file is provided', async () => {
    const boundary = '----emptyboundary';
    const response = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}--\r\n`,
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET / lists documents for the authenticated user', async () => {
    mockList.mockResolvedValue([
      {
        id: 'doc-1',
        name: 'contract.txt',
        fileType: 'txt',
        status: 'ready',
        chunkCount: 3,
        errorMsg: null,
        createdAt: '2026-06-25T00:00:00.000Z',
        updatedAt: '2026-06-25T00:00:00.000Z',
      },
    ]);
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(mockList).toHaveBeenCalledWith('user-1');
  });

  it('GET /:id/status returns lightweight status payload', async () => {
    mockGetStatus.mockResolvedValue({ status: 'processing', chunkCount: 0, errorMsg: null });
    const response = await app.inject({ method: 'GET', url: '/doc-1/status' });

    expect(response.statusCode).toBe(200);
    expect(mockGetStatus).toHaveBeenCalledWith('doc-1', 'user-1');
    expect(JSON.parse(response.payload)).toEqual({
      status: 'processing',
      chunkCount: 0,
      errorMsg: null,
    });
  });

  it('DELETE /:id removes the document and returns 204', async () => {
    mockRemove.mockResolvedValue(undefined);
    const response = await app.inject({ method: 'DELETE', url: '/doc-1' });

    expect(response.statusCode).toBe(204);
    expect(mockRemove).toHaveBeenCalledWith('doc-1', 'user-1');
  });
});
