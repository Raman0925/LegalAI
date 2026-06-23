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
  chunk(text: string): Chunk[];
}

export function createChunker(options?: ChunkOptions): Chunker {
  const chunkSize = options?.maxTokens ?? 512;
  const chunkOverlap = options?.overlapTokens ?? 50;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  function chunk(text: string): Chunk[] {
    if (!text) return [];

    const docs = splitter.createDocumentsSync([text]);
    let charOffset = 0;

    return docs.map((doc) => {
      const content = doc.pageContent;
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
