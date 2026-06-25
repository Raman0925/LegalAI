export const ALLOWED_FILE_TYPES = ['pdf', 'docx', 'txt', 'image'] as const;
export type FileType = (typeof ALLOWED_FILE_TYPES)[number];

export const MIME_TO_FILE_TYPE: Record<string, FileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/tiff': 'image',
};

export const EXTENSION_TO_FILE_TYPE: Record<string, FileType> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  tiff: 'image',
  tif: 'image',
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const CHUNK_MAX_TOKENS = 500;
export const CHUNK_OVERLAP_TOKENS = 50;
export const EMBED_RETRY_ATTEMPTS = 3;
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'legal-docs';
