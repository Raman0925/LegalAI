import { it, expect } from 'vitest';
import { detectFileType, sanitizeFilename } from '../document.util.js';

it('detects file type from a known mimetype', () => {
  expect(detectFileType('application/pdf', 'contract.pdf')).toBe('pdf');
  expect(detectFileType('text/plain', 'notes.txt')).toBe('txt');
  expect(detectFileType('image/png', 'scan.png')).toBe('image');
});

it('falls back to the file extension when mimetype is unrecognized', () => {
  expect(detectFileType('application/octet-stream', 'contract.docx')).toBe('docx');
  expect(detectFileType('application/octet-stream', 'scan.tiff')).toBe('image');
});

it('throws a 415 error for unsupported file types', () => {
  expect.assertions(2);
  try {
    detectFileType('application/zip', 'archive.zip');
  } catch (err: any) {
    expect(err.message).toMatch(/Unsupported file type/);
    expect(err.statusCode).toBe(415);
  }
});

it('sanitizes filenames by replacing unsafe characters', () => {
  expect(sanitizeFilename('My Contract (final) v2.pdf')).toBe('My_Contract__final__v2.pdf');
});
