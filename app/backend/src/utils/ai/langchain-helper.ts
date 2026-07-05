/**
 * Helper to safely extract text from LangChain message content chunks.
 * LangChain's chunk.content can be either a string or an array of blocks.
 */
export function extractTextFromContent(content: string | any[] | Record<string, any> | undefined | null): string {
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block && typeof block === 'object' && block.type === 'text')
      .map((block: any) => block.text || '')
      .join('');
  }
  return '';
}
