import { it, expect } from 'vitest';
import { createChunker } from '../chunker.js';

it('Chunker splits long text into multiple chunks', async () => {
  const chunker = createChunker({ maxTokens: 40, overlapTokens: 5 });
  const text = 'Paragraph one has some text.\n\nParagraph two has more text here.\n\nParagraph three is the final paragraph.';
  const chunks = await chunker.chunk(text);

  expect(chunks.length).toBeGreaterThan(1);
  for (const chunk of chunks) {
    const extractedText = text.substring(chunk.startChar, chunk.endChar);
    expect(extractedText.trim()).toBe(chunk.text.trim());
  }
});

it('Chunker respects maxTokens per chunk', async () => {
  const maxTokens = 20;
  const chunker = createChunker({ maxTokens, overlapTokens: 2 });
  const text = 'This is a test sentence that is quite long and should result in multiple small chunks.';
  const chunks = await chunker.chunk(text);

  expect(chunks.length).toBeGreaterThan(1);
  for (const chunk of chunks) {
    expect(chunk.tokenCount).toBeLessThanOrEqual(maxTokens);
  }
});
