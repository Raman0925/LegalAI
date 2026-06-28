import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';
import { config } from '#config/index.js';
import { ContractAnnotation, ClauseType, RiskLevel, CLAUSE_TYPES } from './contracts.types.js';

interface PageChunk {
  pageNumber: number;
  content: string;
}

interface RawAnnotation {
  page_number: number;
  clause_type: string;
  risk_level: string;
  clause_text: string;
  explanation: string;
  suggestion: string | null;
  citation_ref: string | null;
}

/**
 * Analyze a batch of pages and extract clause annotations.
 * Processes pages in batches to stay within context window.
 * Yields annotations as they are generated.
 */
export async function* analyzeContractPages(
  contractId: string,
  pages: PageChunk[]
): AsyncGenerator<Omit<ContractAnnotation, 'id' | 'createdAt'>> {

  // Batch pages into ~6000 token chunks to stay under context limit
  const batches = batchPages(pages, 6000);

  for (const batch of batches) {
    const context = batch
      .map(p => `[PAGE ${p.pageNumber}]\n${p.content}`)
      .join('\n\n---\n\n');

    const prompt = `You are a senior legal analyst reviewing a contract. 
Analyze the following contract pages and identify all legally significant clauses.

For each clause found, return a JSON array. Each item must have:
- page_number: integer (which page the clause appears on)
- clause_type: one of ${CLAUSE_TYPES.join(', ')}
- risk_level: "low" | "medium" | "high" | "critical"
- clause_text: the exact quoted text of the clause (max 500 chars)
- explanation: plain English explanation of what this clause means for the client (2-3 sentences)
- suggestion: optional improvement suggestion if risk is high/critical, else null
- citation_ref: clause reference if visible (e.g. "Section 7.2(b)"), else null

Risk level guide:
- critical: could expose client to unlimited liability or major loss
- high: unfavorable terms needing negotiation
- medium: standard terms worth noting
- low: routine clauses, no concern

Return ONLY valid JSON array. No markdown, no preamble, no explanation outside the JSON.

CONTRACT PAGES:
${context}`;

    let rawResponse = '';
    try {
      const llm = new ChatAnthropic({
        modelName: 'claude-3-5-sonnet-20241022',
        apiKey: config.anthropicApiKey,
        maxTokens: 4096,
        temperature: 0.1,
      });

      const stream = await llm.stream([new HumanMessage(prompt)]);

      for await (const chunk of stream) {
        const text =
          typeof chunk.content === 'string'
            ? chunk.content
            : chunk.content
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join('');
        rawResponse += text;
      }
    } catch (err) {
      console.error('AI analysis failed for batch:', err);
      continue; // Skip batch, don't abort entire analysis
    }

    // Parse and validate response
    let annotations: RawAnnotation[] = [];
    try {
      const cleaned = rawResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      annotations = JSON.parse(cleaned);
      if (!Array.isArray(annotations)) annotations = [];
    } catch {
      console.error('Failed to parse AI annotation response');
      continue;
    }

    for (const raw of annotations) {
      if (!isValidAnnotation(raw)) continue;

      yield {
        contractId,
        pageNumber: raw.page_number,
        clauseType: raw.clause_type as ClauseType,
        riskLevel: raw.risk_level as RiskLevel,
        clauseText: raw.clause_text.slice(0, 500),
        explanation: raw.explanation,
        suggestion: raw.suggestion ?? null,
        bbox: null,             // populated in future phase with PDF.js coords
        citationRef: raw.citation_ref ?? null,
      };
    }
  }
}

/**
 * Batch pages so each batch stays under maxTokens limit.
 */
function batchPages(pages: PageChunk[], maxTokens: number): PageChunk[][] {
  const batches: PageChunk[][] = [];
  let current: PageChunk[] = [];
  let currentTokens = 0;

  for (const page of pages) {
    const pageTokens = Math.ceil(page.content.length / 4);
    if (currentTokens + pageTokens > maxTokens && current.length > 0) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(page);
    currentTokens += pageTokens;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

function isValidAnnotation(raw: unknown): raw is RawAnnotation {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.page_number === 'number' &&
    typeof r.clause_type === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(r.risk_level as string) &&
    typeof r.clause_text === 'string' &&
    typeof r.explanation === 'string'
  );
}
