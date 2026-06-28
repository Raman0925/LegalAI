import { PDFParse } from 'pdf-parse';

export interface ExtractedPage {
  pageNumber: number;
  content: string;
  tokenCount: number;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  totalPages: number;
  totalTokens: number;
}

/**
 * Extract text content page-by-page from a PDF buffer.
 */
export async function extractPdfPages(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pages: ExtractedPage[] = (result.pages || [])
      .map((p) => ({
        pageNumber: p.num,
        content: p.text.replace(/\s+/g, ' ').trim(),
        tokenCount: estimateTokens(p.text),
      }))
      .filter((p) => p.content.length > 0);

    const totalTokens = pages.reduce((sum, p) => sum + p.tokenCount, 0);

    return {
      pages,
      totalPages: result.total,
      totalTokens,
    };
  } finally {
    await parser.destroy();
  }
}

/**
 * Rough token estimation: ~4 chars per token for English legal text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Validate that a buffer is a real PDF (checks magic bytes)
 */
export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.slice(0, 4).toString() === '%PDF';
}
