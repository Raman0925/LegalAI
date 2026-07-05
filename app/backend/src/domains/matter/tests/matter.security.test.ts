import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMatterService } from '../matter.service.js';

const mockMatterRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  listByFirm: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  attachDocument: vi.fn(),
  detachDocument: vi.fn(),
  saveClauses: vi.fn(),
  saveDraft: vi.fn(),
  deleteDraft: vi.fn(),
  getDetails: vi.fn(),
  getDocChunks: vi.fn(),
};

const mockDocRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  listByFirm: vi.fn(),
  updateStatus: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../matter.repository.js', () => ({
  createMatterRepository: vi.fn(() => mockMatterRepo),
}));

vi.mock('../../document/document.repository.js', () => ({
  createDocumentRepository: vi.fn(() => mockDocRepo),
}));

describe('MatterService Security - IDOR Prevention', () => {
  let service: ReturnType<typeof createMatterService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createMatterService({} as any);
  });

  it('attachDocument throws 404 if the matter belongs to a different firm', async () => {
    // Mock matter to not exist for firm-1 (e.g. it belongs to firm-2)
    mockMatterRepo.findById.mockResolvedValueOnce(null);

    await expect(
      service.attachDocument('matter-different-firm', 'doc-1', 'firm-1')
    ).rejects.toThrow('Matter not found');

    expect(mockMatterRepo.attachDocument).not.toHaveBeenCalled();
  });

  it('attachDocument throws 404 if the document belongs to a different firm', async () => {
    // Matter exists for firm-1, but document does not
    mockMatterRepo.findById.mockResolvedValueOnce({ id: 'matter-1', firmId: 'firm-1' });
    mockDocRepo.findById.mockResolvedValueOnce(null);

    await expect(
      service.attachDocument('matter-1', 'doc-different-firm', 'firm-1')
    ).rejects.toThrow('Document not found');

    expect(mockMatterRepo.attachDocument).not.toHaveBeenCalled();
  });

  it('detachDocument throws 404 if the matter belongs to a different firm', async () => {
    mockMatterRepo.findById.mockResolvedValueOnce(null);

    await expect(
      service.detachDocument('matter-different-firm', 'doc-1', 'firm-1')
    ).rejects.toThrow('Matter not found');

    expect(mockMatterRepo.detachDocument).not.toHaveBeenCalled();
  });

  it('deleteDraft throws 404 if the matter belongs to a different firm', async () => {
    mockMatterRepo.findById.mockResolvedValueOnce(null);

    await expect(
      service.deleteDraft('matter-different-firm', 'draft-1', 'firm-1')
    ).rejects.toThrow('Matter not found');

    expect(mockMatterRepo.deleteDraft).not.toHaveBeenCalled();
  });
});
