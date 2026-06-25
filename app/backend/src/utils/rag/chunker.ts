import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export interface Chunk {
  text: string;
  startChar: number;
  endChar: number;
  tokenCount: number;
}

export interface Chunker {
  chunk(text: string): Promise<Chunk[]>;
}

export function createChunker(options?: ChunkOptions): Chunker {
  // RecursiveCharacterTextSplitter measures in characters, not tokens.
  // Approximate: 1 token ≈ 4 characters (OpenAI rule of thumb).
  const CHARS_PER_TOKEN = 4;
  const chunkSize = (options?.maxTokens ?? 500) * CHARS_PER_TOKEN; // default: 2000 chars ≈ 500 tokens
  const chunkOverlap = (options?.overlapTokens ?? 50) * CHARS_PER_TOKEN; // default: 200 chars ≈ 50 tokens

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  async function chunk(text: string): Promise<Chunk[]> {
    if (!text) return [];

    const stringChunks = await splitter.splitText(text);
    let charOffset = 0;

    return stringChunks.map((content) => {
      const startChar = text.indexOf(content, charOffset);
      const safeStart = startChar === -1 ? charOffset : startChar;
      const endChar = safeStart + content.length;
      charOffset = safeStart + 1;

      return {
        text: content,
        startChar: safeStart,
        endChar,
        tokenCount: Math.ceil(content.length / 4),
      };
    });
  }

  return { chunk };
}
