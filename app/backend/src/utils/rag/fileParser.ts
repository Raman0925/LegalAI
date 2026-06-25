import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

export type ParsableFileType = 'pdf' | 'docx' | 'txt' | 'image';

export async function parseFile(buffer: Buffer, fileType: ParsableFileType): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return parsePdf(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'txt':
      return buffer.toString('utf-8');
    case 'image':
      return parseImage(buffer);
  }
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(buffer);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
