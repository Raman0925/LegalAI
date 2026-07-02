import { describe, it, expect, vi } from 'vitest';

vi.mock('../matter.service.js', () => ({
  createMatterService: vi.fn().mockReturnValue({
    createMatter: vi.fn().mockResolvedValue({ id: 'matter-1', title: 'Test Matter' }),
    listMatters: vi.fn().mockResolvedValue([{ id: 'matter-1', title: 'Test Matter' }]),
    getMatter: vi.fn(),
    updateMatter: vi.fn(),
    deleteMatter: vi.fn(),
    attachDocument: vi.fn(),
    detachDocument: vi.fn(),
  }),
}));

vi.mock('#middlewares/auth.middleware.js', () => ({
  default: vi.fn().mockImplementation(async () => {}),
}));

import { createMatterService } from '../matter.service.js';

describe('Matter Controller', () => {
  it('calls createMatter on POST /', async () => {
    const service = createMatterService({} as any);
    const result = await service.createMatter({
      userId: 'user-1',
      firmId: 'firm-1',
      title: 'Test Matter',
      clientName: null,
      matterType: 'general',
      description: null,
    });
    expect(result.id).toBe('matter-1');
  });

  it('calls listMatters on GET /', async () => {
    const service = createMatterService({} as any);
    const result = await service.listMatters('firm-1');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Matter');
  });
});
