import { FastifyError } from 'fastify';
import { EXTENSION_TO_FILE_TYPE, MIME_TO_FILE_TYPE, FileType } from './document.constant.js';

export function detectFileType(mimetype: string, filename: string): FileType {
  const fromMime = MIME_TO_FILE_TYPE[mimetype.toLowerCase()];
  if (fromMime) return fromMime;

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const fromExt = EXTENSION_TO_FILE_TYPE[ext];
  if (fromExt) return fromExt;

  const error = new Error(`Unsupported file type: ${mimetype || ext}`) as FastifyError;
  error.statusCode = 415;
  throw error;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}
