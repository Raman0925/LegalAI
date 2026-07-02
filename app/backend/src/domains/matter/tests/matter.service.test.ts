import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../matter.repository.js', () => ({
  createMatterRepository: vi.fn().mockReturnValue({
    create: vi.fn().mockResolvedValue({ id: 'matter-1', title: 'Test Matter', userId: 'user-1', firmId: 'firm-1' }),
    findById: vi.fn(),
    listByFirm: vi.fn().mockResolvedValue([{ id: 'matter-1', title: 'Test Matter' }]),
    update: vi.fn(),
    delete: vi.fn(),
    attachDocument: vi.fn(),
    detachDocument: vi.fn(),
    getDetails: vi.fn(),
  }),
}));

vi.mock('../../document/document.repository.js', () => ({
  createDocumentRepository: vi.fn().mockReturnValue({
    findById: vi.fn(),
  }),
}));

import { createMatterService } from '../matter.service.js';

describe('MatterService', () => {
  let service: ReturnType<typeof createMatterService>;

  beforeEach(() => {
    service = createMatterService({} as any);
  });

  it('createMatter calls repository.create', async () => {
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

  it('listMatters calls repository.listByFirm', async () => {
    const result = await service.listMatters('firm-1');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Matter');
  });
});
