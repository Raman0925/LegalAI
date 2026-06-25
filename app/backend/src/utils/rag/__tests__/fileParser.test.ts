import { vi, it, expect, beforeEach } from 'vitest';

const { mockGetText, mockDestroy, mockExtractRawText, mockRecognize, mockTerminate } = vi.hoisted(
  () => ({
    mockGetText: vi.fn(),
    mockDestroy: vi.fn(),
    mockExtractRawText: vi.fn(),
    mockRecognize: vi.fn(),
    mockTerminate: vi.fn(),
  }),
);

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

vi.mock('mammoth', () => ({
  default: { extractRawText: mockExtractRawText },
}));

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: mockRecognize,
    terminate: mockTerminate,
  }),
}));

import { parseFile } from '../fileParser.js';

beforeEach(() => {
  vi.clearAllMocks();
});

it('parses txt files by reading the buffer as utf-8', async () => {
  const text = await parseFile(Buffer.from('hello world'), 'txt');
  expect(text).toBe('hello world');
});

it('parses pdf files via pdf-parse and destroys the parser afterwards', async () => {
  mockGetText.mockResolvedValue({ text: 'pdf contents' });
  const text = await parseFile(Buffer.from('%PDF'), 'pdf');
  expect(text).toBe('pdf contents');
  expect(mockDestroy).toHaveBeenCalledOnce();
});

it('parses docx files via mammoth.extractRawText', async () => {
  mockExtractRawText.mockResolvedValue({ value: 'docx contents' });
  const text = await parseFile(Buffer.from('docx'), 'docx');
  expect(text).toBe('docx contents');
  expect(mockExtractRawText).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
});

it('parses images via tesseract.js OCR', async () => {
  mockRecognize.mockResolvedValue({ data: { text: 'ocr contents' } });
  const text = await parseFile(Buffer.from('image'), 'image');
  expect(text).toBe('ocr contents');
  expect(mockRecognize).toHaveBeenCalledWith(expect.any(Buffer));
  expect(mockTerminate).toHaveBeenCalledOnce();
});
