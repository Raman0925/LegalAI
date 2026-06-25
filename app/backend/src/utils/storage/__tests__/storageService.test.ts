import { vi, it, expect, beforeEach } from 'vitest';
import { createStorageService } from '../storageService.js';

const mockUpload = vi.fn();
const mockRemove = vi.fn();
const mockFrom = vi.fn(() => ({ upload: mockUpload, remove: mockRemove }));
const client: any = { storage: { from: mockFrom } };

beforeEach(() => {
  vi.clearAllMocks();
});

it('uploads a file to the configured bucket', async () => {
  mockUpload.mockResolvedValue({ error: null });
  const storage = createStorageService(client, 'legal-docs');

  await storage.upload('user-1/doc-1/file.pdf', Buffer.from('data'), 'application/pdf');

  expect(mockFrom).toHaveBeenCalledWith('legal-docs');
  expect(mockUpload).toHaveBeenCalledWith('user-1/doc-1/file.pdf', expect.any(Buffer), {
    contentType: 'application/pdf',
    upsert: false,
  });
});

it('throws when upload fails', async () => {
  mockUpload.mockResolvedValue({ error: { message: 'bucket not found' } });
  const storage = createStorageService(client, 'legal-docs');

  await expect(storage.upload('a', Buffer.from('x'), 'text/plain')).rejects.toThrow(
    'bucket not found',
  );
});

it('removes a file from the configured bucket', async () => {
  mockRemove.mockResolvedValue({ error: null });
  const storage = createStorageService(client, 'legal-docs');

  await storage.remove('user-1/doc-1/file.pdf');

  expect(mockRemove).toHaveBeenCalledWith(['user-1/doc-1/file.pdf']);
});

it('throws when delete fails', async () => {
  mockRemove.mockResolvedValue({ error: { message: 'not found' } });
  const storage = createStorageService(client, 'legal-docs');

  await expect(storage.remove('missing')).rejects.toThrow('not found');
});
