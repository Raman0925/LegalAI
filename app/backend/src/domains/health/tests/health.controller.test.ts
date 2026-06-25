import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import healthController from '../health.controller.js';

describe('Health Controller Routes', () => {
  let app: any;
  let mockQuery: any;

  beforeEach(async () => {
    app = Fastify();
    mockQuery = vi.fn();

    // Decorate the fastify instance with the mocked pg pool
    app.decorate('pg', {
      query: mockQuery,
    });

    app.register(healthController);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns 200 and UP status when DB is connected successfully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('UP');
    expect(body.services.database.status).toBe('UP');
    expect(body.timestamp).toBeDefined();
    expect(body.uptime).toBeTypeOf('number');
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
  });

  it('GET /health returns 503 and DOWN status when DB check fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection timeout'));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('DOWN');
    expect(body.services.database.status).toBe('DOWN');
    expect(body.error).toBe('Connection timeout');
    expect(body.timestamp).toBeDefined();
    expect(body.uptime).toBeTypeOf('number');
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
  });
});
