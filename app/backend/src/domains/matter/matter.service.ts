import pg from 'pg';
import { FastifyError } from 'fastify';
import { z } from 'zod';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document as DocxDocument, Paragraph, TextRun, Packer, HeadingLevel } from 'docx';
import { createMatterRepository, MatterRepository } from './matter.repository.js';
import { createDocumentRepository } from '../document/document.repository.js';
import {
  MatterRecord,
  MatterClause,
  MatterDraft,
  MatterWithDetails,
  MatterType,
  MatterStatus,
  DraftType,
  RiskLevel,
} from './matter.model.js';
import { MAX_CLAUSE_EXTRACTION_CHARS, DRAFT_GENERATION_MODEL } from './matter.constant.js';
import { createStructuredExtractor } from '../../utils/ai/structured-extractor.js';
import { createAnthropicProvider } from '../../utils/ai/anthropic-provider.js';

const ClauseSchema = z.object({
  clauses: z.array(
    z.object({
      clauseType: z.enum([
        'indemnity',
        'termination',
        'ip',
        'confidentiality',
        'payment',
        'liability',
        'governing_law',
        'dispute_resolution',
        'warranty',
        'other',
      ]),
      content: z.string(),
      riskLevel: z.enum(['high', 'medium', 'low']).optional(),
      summary: z.string(),
    }),
  ),
});

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required but not set.');
}
const extractor = createStructuredExtractor(anthropicApiKey);
const provider = createAnthropicProvider(anthropicApiKey);

export interface MatterService {
  createMatter(params: {
    userId: string;
    firmId: string;
    title: string;
    clientName: string | null;
    matterType: MatterType;
    description: string | null;
    status?: MatterStatus;
  }): Promise<MatterRecord>;
  listMatters(firmId: string): Promise<MatterRecord[]>;
  getMatter(id: string, firmId: string): Promise<MatterWithDetails>;
  updateMatter(
    id: string,
    firmId: string,
    params: {
      title?: string;
      clientName?: string | null;
      matterType?: MatterType;
      status?: MatterStatus;
      description?: string | null;
    },
  ): Promise<MatterRecord>;
  deleteMatter(id: string, firmId: string): Promise<void>;
  attachDocument(matterId: string, documentId: string, firmId: string): Promise<void>;
  detachDocument(matterId: string, documentId: string, firmId: string): Promise<void>;
  extractClauses(matterId: string, firmId: string): Promise<MatterClause[]>;
  generateDraft(
    matterId: string,
    firmId: string,
    draftType: DraftType,
    instructions: string,
    title: string,
  ): Promise<MatterDraft>;
  deleteDraft(matterId: string, draftId: string, firmId: string): Promise<void>;
  exportMatter(
    matterId: string,
    firmId: string,
    format: 'pdf' | 'docx',
  ): Promise<{ buffer: Buffer; mimeType: string }>;
}

export function createMatterService(pgPool: pg.Pool): MatterService {
  const repository = createMatterRepository(pgPool);
  const documentRepository = createDocumentRepository(pgPool);

  async function createMatter(params: {
    userId: string;
    firmId: string;
    title: string;
    clientName: string | null;
    matterType: MatterType;
    description: string | null;
    status?: MatterStatus;
  }): Promise<MatterRecord> {
    return repository.create(params);
  }

  async function listMatters(firmId: string): Promise<MatterRecord[]> {
    return repository.listByFirm(firmId);
  }

  async function getMatter(id: string, firmId: string): Promise<MatterWithDetails> {
    const details = await repository.getDetails(id, firmId);
    if (!details) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }
    return details;
  }

  async function updateMatter(
    id: string,
    firmId: string,
    params: {
      title?: string;
      clientName?: string | null;
      matterType?: MatterType;
      status?: MatterStatus;
      description?: string | null;
    },
  ): Promise<MatterRecord> {
    const result = await repository.update(id, firmId, params);
    if (!result) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }
    return result;
  }

  async function deleteMatter(id: string, firmId: string): Promise<void> {
    const success = await repository.delete(id, firmId);
    if (!success) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }
  }

  async function attachDocument(
    matterId: string,
    documentId: string,
    firmId: string,
  ): Promise<void> {
    // Verify user owns both matter and document within the firm
    const matter = await repository.findById(matterId, firmId);
    if (!matter) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }

    const document = await documentRepository.findById(documentId, firmId);
    if (!document) {
      const error = new Error('Document not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }

    await repository.attachDocument(matterId, documentId);
  }

  async function detachDocument(
    matterId: string,
    documentId: string,
    firmId: string,
  ): Promise<void> {
    // Verify user owns matter
    const matter = await repository.findById(matterId, firmId);
    if (!matter) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }

    await repository.detachDocument(matterId, documentId);
  }

  async function extractClauses(matterId: string, firmId: string): Promise<MatterClause[]> {
    const matter = await repository.findById(matterId, firmId);
    if (!matter) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }

    const details = await repository.getDetails(matterId, firmId);
    if (!details) {
      throw new Error('Could not fetch matter details');
    }

    const readyDocs = details.attachedDocuments.filter((d) => d.status === 'ready');

    if (readyDocs.length === 0) {
      // Nothing to extract — clear any stale clauses and return empty
      await repository.saveClauses(matterId, []);
      return [];
    }

    // Reset all clauses for this matter before re-extraction

    const extractedClausesList: Array<{
      documentId: string;
      clauseType: string;
      content: string;
      riskLevel: RiskLevel | null;
    }> = [];

    for (const doc of readyDocs) {
      const chunks = await repository.getDocChunks(doc.id);
      let text = chunks.join('\n');
      if (text.length > MAX_CLAUSE_EXTRACTION_CHARS) {
        text = text.slice(0, MAX_CLAUSE_EXTRACTION_CHARS);
      }
      if (!text.trim()) continue;

      const systemPrompt = `You are an expert legal counsel. Extract all key clauses from the provided document context. For each clause, categorize it into one of these types: indemnity, termination, ip, confidentiality, payment, liability, governing_law, dispute_resolution, warranty, other. Rate the risk level as high, medium, or low. Provide a short summary.`;

      try {
        const result = await extractor.extractWithRetry(ClauseSchema, systemPrompt, text);
        if (result && result.clauses) {
          for (const c of result.clauses) {
            extractedClausesList.push({
              documentId: doc.id,
              clauseType: c.clauseType,
              content: c.content,
              riskLevel: (c.riskLevel as RiskLevel) || null,
            });
          }
        }
      } catch (err) {
        // Log the error but continue processing remaining documents
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          JSON.stringify({
            level: 'error',
            msg: 'Clause extraction failed',
            documentId: doc.id,
            error: message,
          }) + '\n',
        );
      }
    }

    // Delete existing clauses then bulk-insert new ones
    await repository.saveClauses(matterId, []);
    if (extractedClausesList.length > 0) {
      await repository.saveClauses(matterId, extractedClausesList);
    }

    const updatedDetails = await repository.getDetails(matterId, firmId);
    return updatedDetails?.clauses || [];
  }

  async function generateDraft(
    matterId: string,
    firmId: string,
    draftType: DraftType,
    instructions: string,
    title: string,
  ): Promise<MatterDraft> {
    // getDetails already does the ownership check internally via findById
    const details = await repository.getDetails(matterId, firmId);
    if (!details) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }

    let documentContext = '';
    const readyDocs = details.attachedDocuments.filter((d) => d.status === 'ready');
    for (const doc of readyDocs) {
      const chunks = await repository.getDocChunks(doc.id);
      const text = chunks.join('\n');
      if (documentContext.length + text.length > MAX_CLAUSE_EXTRACTION_CHARS) {
        const remainingSpace = MAX_CLAUSE_EXTRACTION_CHARS - documentContext.length;
        if (remainingSpace > 0) {
          documentContext += text.slice(0, remainingSpace);
        }
        break;
      }
      documentContext += text + '\n';
    }

    const clausesText = details.clauses
      .map((c) => `[Type: ${c.clauseType}, Risk: ${c.riskLevel || 'low'}]\nContent: ${c.content}`)
      .join('\n\n');

    const systemPrompt = `You are a world-class legal draft writer. Generate a precise, legally binding, professional draft document. Follow the provided matter details, referenced document context, existing clauses, and draft instructions. Do not write any conversational intro or outro. Output ONLY the drafted document text.`;

    const userPrompt = `
Matter Details:
Title: ${details.title}
Client: ${details.clientName || 'N/A'}
Type: ${details.matterType}
Description: ${details.description || 'N/A'}

Referenced Document Context (truncated to 50k chars):
${documentContext || 'None'}

Extracted Key Clauses:
${clausesText || 'None'}

Draft Type: ${draftType}
Title: ${title}
Instructions: ${instructions}

Please generate the draft document now:
`;

    const completionResult = await provider.complete({
      model: DRAFT_GENERATION_MODEL,
      messages: [{ role: 'user', content: userPrompt }],
      systemPrompt,
      temperature: 0.2,
    });

    const savedDraft = await repository.saveDraft(matterId, {
      title,
      content: completionResult.text,
      draftType,
    });

    return savedDraft;
  }

  async function deleteDraft(matterId: string, draftId: string, firmId: string): Promise<void> {
    const matter = await repository.findById(matterId, firmId);
    if (!matter) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }

    const success = await repository.deleteDraft(matterId, draftId);
    if (!success) {
      const error = new Error('Draft not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }
  }

  async function exportMatter(
    matterId: string,
    firmId: string,
    format: 'pdf' | 'docx',
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const details = await repository.getDetails(matterId, firmId);
    if (!details) {
      const error = new Error('Matter not found') as FastifyError;
      error.statusCode = 404;
      throw error;
    }

    if (format === 'pdf') {
      const buffer = await generatePdf(details);
      return { buffer, mimeType: 'application/pdf' };
    } else {
      const buffer = await generateDocx(details);
      return {
        buffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }
  }

  return {
    createMatter,
    listMatters,
    getMatter,
    updateMatter,
    deleteMatter,
    attachDocument,
    detachDocument,
    extractClauses,
    generateDraft,
    deleteDraft,
    exportMatter,
  };
}

async function generatePdf(details: MatterWithDetails): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  let y = height - 50;
  const margin = 50;
  const contentWidth = width - 2 * margin;

  function addText(text: string, fontToUse = font, size = 11, lineSpacing = 16) {
    const lines = text.split('\n');
    for (const paragraph of lines) {
      if (!paragraph.trim()) {
        y -= lineSpacing;
        if (y < margin) {
          page = pdfDoc.addPage();
          y = height - 50;
        }
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = fontToUse.widthOfTextAtSize(testLine, size);
        if (testWidth > contentWidth) {
          page.drawText(currentLine, {
            x: margin,
            y,
            size,
            font: fontToUse,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= lineSpacing;
          if (y < margin) {
            page = pdfDoc.addPage();
            y = height - 50;
          }
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        page.drawText(currentLine, {
          x: margin,
          y,
          size,
          font: fontToUse,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= lineSpacing;
        if (y < margin) {
          page = pdfDoc.addPage();
          y = height - 50;
        }
      }
    }
  }

  page.drawText(`LEGAL MATTER REPORT: ${details.title.toUpperCase()}`, {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.3, 0.1, 0.6),
  });
  y -= 25;

  addText(`Client Name: ${details.clientName || 'N/A'}`, boldFont, 11, 16);
  addText(`Matter Type: ${details.matterType.toUpperCase()}`, font, 10, 14);
  addText(`Status: ${details.status.toUpperCase()}`, font, 10, 14);
  if (details.description) {
    addText(`Description: ${details.description}`, font, 10, 14);
  }
  y -= 20;

  if (details.attachedDocuments.length > 0) {
    page.drawText('ATTACHED DOCUMENTS', {
      x: margin,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0.3, 0.1, 0.6),
    });
    y -= 18;
    for (const doc of details.attachedDocuments) {
      addText(`- ${doc.name} (${doc.fileType.toUpperCase()}, ${doc.status})`, font, 10, 14);
    }
    y -= 15;
  }

  if (details.clauses.length > 0) {
    if (y < margin + 50) {
      page = pdfDoc.addPage();
      y = height - 50;
    }
    page.drawText('EXTRACTED CLAUSES', {
      x: margin,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0.3, 0.1, 0.6),
    });
    y -= 18;
    for (const c of details.clauses) {
      addText(
        `Type: ${c.clauseType.toUpperCase()} | Risk: ${(c.riskLevel || 'low').toUpperCase()}`,
        boldFont,
        10,
        14,
      );
      addText(c.content, font, 9, 13);
      y -= 10;
      if (y < margin) {
        page = pdfDoc.addPage();
        y = height - 50;
      }
    }
  }

  if (details.drafts.length > 0) {
    if (y < margin + 50) {
      page = pdfDoc.addPage();
      y = height - 50;
    }
    page.drawText('GENERATED DRAFTS', {
      x: margin,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0.3, 0.1, 0.6),
    });
    y -= 18;
    for (const d of details.drafts) {
      addText(`Draft: ${d.title} (${d.draftType.toUpperCase()})`, boldFont, 11, 15);
      addText(d.content, font, 9, 13);
      y -= 15;
      if (y < margin) {
        page = pdfDoc.addPage();
        y = height - 50;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function generateDocx(details: MatterWithDetails): Promise<Buffer> {
  const children: any[] = [
    new Paragraph({
      text: `Legal Matter Report: ${details.title}`,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Client Name: ', bold: true }),
        new TextRun(details.clientName || 'N/A'),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Matter Type: ', bold: true }),
        new TextRun(details.matterType),
      ],
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Status: ', bold: true }), new TextRun(details.status)],
    }),
  ];

  if (details.description) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Description: ', bold: true }),
          new TextRun(details.description),
        ],
      }),
    );
  }

  children.push(new Paragraph({ text: '' }));

  if (details.attachedDocuments.length > 0) {
    children.push(
      new Paragraph({
        text: 'Attached Documents',
        heading: HeadingLevel.HEADING_2,
      }),
    );
    for (const doc of details.attachedDocuments) {
      children.push(
        new Paragraph({
          text: `- ${doc.name} (${doc.fileType.toUpperCase()}, status: ${doc.status})`,
        }),
      );
    }
    children.push(new Paragraph({ text: '' }));
  }

  if (details.clauses.length > 0) {
    children.push(
      new Paragraph({
        text: 'Extracted Clauses',
        heading: HeadingLevel.HEADING_2,
      }),
    );
    for (const c of details.clauses) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Type: ${c.clauseType} | Risk: ${c.riskLevel || 'low'}\n`,
              bold: true,
            }),
            new TextRun(c.content),
          ],
        }),
      );
      children.push(new Paragraph({ text: '' }));
    }
  }

  if (details.drafts.length > 0) {
    children.push(
      new Paragraph({
        text: 'Generated Drafts',
        heading: HeadingLevel.HEADING_2,
      }),
    );
    for (const d of details.drafts) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Draft Title: ${d.title} (${d.draftType.toUpperCase()})\n`,
              bold: true,
            }),
          ],
        }),
      );
      const paragraphs = d.content.split('\n');
      for (const p of paragraphs) {
        if (p.trim()) {
          children.push(new Paragraph({ text: p }));
        }
      }
      children.push(new Paragraph({ text: '' }));
    }
  }

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
