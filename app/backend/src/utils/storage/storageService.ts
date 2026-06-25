import { SupabaseClient } from '@supabase/supabase-js';

export interface StorageService {
  upload(path: string, file: Buffer, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export function createStorageService(client: SupabaseClient, bucket: string): StorageService {
  async function upload(path: string, file: Buffer, contentType: string): Promise<void> {
    const { error } = await client.storage.from(bucket).upload(path, file, {
      contentType,
      upsert: false,
    });
    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  async function remove(path: string): Promise<void> {
    const { error } = await client.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }

  return { upload, remove };
}
