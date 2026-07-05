import { SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document as DocxDocument, Paragraph, TextRun, Packer, HeadingLevel } from 'docx';
import * as repo from './contracts.repository.js';
import { extractPdfPages, isPdfBuffer } from './contracts.extractor.js';
import { analyzeContractPages } from './contracts.analyzer.js';
import { AnalysisStreamChunk, ContractAnnotation, ContractWithUrl } from './contracts.types.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = ['application/pdf'];

/**
 * Upload contract to Supabase Storage + save metadata.
 * Returns immediately — analysis runs separately via SSE endpoint.
 */
export async function uploadContract(
  supabase: SupabaseClient,
  params: {
    firmId: string;
    userId: string;
    matterId?: string;
    filename: string;
    buffer: Buffer;
    mimeType: string;
    fileSizeBytes: number;
  }
) {
  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(params.mimeType)) {
    throw new Error('Only PDF files are accepted');
  }

  if (params.fileSizeBytes > MAX_FILE_SIZE) {
    throw new Error('File exceeds 20MB limit');
  }

  // Validate PDF magic bytes
  if (!isPdfBuffer(params.buffer)) {
    throw new Error('File is not a valid PDF');
  }

  // Create DB record first to get the ID for storage path
  const contract = await repo.createContract(supabase, {
    firmId: params.firmId,
    userId: params.userId,
    matterId: params.matterId,
    filename: params.filename,
    storagePath: '',      // updated after upload
    storageUrl: '',
    fileSizeBytes: params.fileSizeBytes,
  });

  // Upload to Supabase Storage
  const storagePath = `contracts/${params.firmId}/${contract.id}/${params.filename}`;
  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(storagePath, params.buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    // Rollback DB record
    await supabase.from('contracts').delete().eq('id', contract.id);
    throw new Error('File upload failed');
  }

  const secureStorageUrl = `private://${storagePath}`;

  // Update contract with storage path
  const { data: updateData, error: updateError } = await supabase
    .from('contracts')
    .update({ storage_path: storagePath, storage_url: secureStorageUrl })
    .eq('id', contract.id)
    .select();

  if (updateError) {
    await supabase.storage.from('contracts').remove([storagePath]);
    await supabase.from('contracts').delete().eq('id', contract.id);
    throw new Error('Failed to update contract storage paths: ' + updateError.message);
  }

  return { ...contract, storagePath, storageUrl: secureStorageUrl };
}

/**
 * Run AI analysis on a contract and stream progress + annotations.
 * Called by the SSE endpoint after upload.
 */
export async function* streamContractAnalysis(
  supabase: SupabaseClient,
  contractId: string,
  firmId: string,
  signal?: AbortSignal
): AsyncGenerator<AnalysisStreamChunk> {
  const contract = await repo.getContractById(supabase, contractId, firmId);
  if (!contract) {
    yield { type: 'error', error: 'Contract not found' };
    return;
  }

  if (signal?.aborted) return;

  // Mark as processing
  await repo.updateContractStatus(supabase, contractId, firmId, 'processing');
  yield { type: 'progress', progress: 5, message: 'Starting analysis...' };

  if (signal?.aborted) return;

  // Download contract from storage
  let buffer: Buffer;
  try {
    const { data, error } = await supabase.storage
      .from('contracts')
      .download(contract.storagePath);
    if (error || !data) throw new Error('Download failed');
    buffer = Buffer.from(await data.arrayBuffer());
  } catch {
    await repo.updateContractStatus(supabase, contractId, firmId, 'failed');
    yield { type: 'error', error: 'Failed to download contract for analysis' };
    return;
  }

  if (signal?.aborted) return;
  yield { type: 'progress', progress: 15, message: 'Extracting text from PDF...' };

  // Extract pages
  let extractionResult;
  try {
    extractionResult = await extractPdfPages(buffer);
  } catch {
    await repo.updateContractStatus(supabase, contractId, firmId, 'failed');
    yield { type: 'error', error: 'PDF text extraction failed' };
    return;
  }

  if (signal?.aborted) return;

  // Save pages to DB
  try {
    await repo.saveContractPages(supabase, extractionResult.pages.map(p => ({
      contractId,
      pageNumber: p.pageNumber,
      content: p.content,
      tokenCount: p.tokenCount,
    })));
    await repo.updateContractStatus(
      supabase, contractId, firmId, 'processing',
      extractionResult.totalPages
    );
  } catch {
    yield { type: 'error', error: 'Failed to save extracted pages' };
    return;
  }

  if (signal?.aborted) return;
  yield {
    type: 'progress',
    progress: 30,
    message: `Extracted ${extractionResult.totalPages} pages. Running AI analysis...`,
  };

  // Run AI analysis — stream annotations as they arrive
  let annotationCount = 0;
  try {
    const analysisStream = analyzeContractPages(contractId, extractionResult.pages, signal);

    for await (const annotation of analysisStream) {
      // Save each annotation to DB as it comes
      let saved: ContractAnnotation;
      try {
        saved = await repo.saveAnnotation(supabase, annotation);
      } catch {
        continue; // Skip failed saves, don't abort
      }

      annotationCount++;
      const progress = Math.min(30 + Math.floor((annotationCount / 20) * 60), 90);

      yield { type: 'annotation', annotation: saved };
      yield {
        type: 'progress',
        progress,
        message: `Found ${annotationCount} clauses...`,
      };
    }
  } catch (err) {
    // Analysis partially failed — mark as ready with what we have
    console.error('Analysis stream error:', err);
  }

  // Mark as ready
  await repo.updateContractStatus(supabase, contractId, firmId, 'ready');
  yield { type: 'progress', progress: 100, message: 'Analysis complete' };
  yield { type: 'done' };
}

/**
 * Get contract with a fresh signed URL for the PDF viewer.
 */
export async function getContractWithSignedUrl(
  supabase: SupabaseClient,
  contractId: string,
  firmId: string
): Promise<ContractWithUrl | null> {
  const contract = await repo.getContractById(supabase, contractId, firmId);
  if (!contract) return null;

  const signedUrl = await repo.getSignedUrl(supabase, contract.storagePath);
  return { ...contract, signedUrl };
}

/**
 * Export contract review report as PDF or DOCX buffer.
 */
export async function exportContractReviewReport(
  supabase: SupabaseClient,
  contractId: string,
  firmId: string,
  format: 'pdf' | 'docx'
): Promise<{ buffer: Buffer; mimeType: string }> {
  const contract = await repo.getContractById(supabase, contractId, firmId);
  if (!contract) {
    throw new Error('Contract not found');
  }

  const annotations = await repo.getAnnotationsByContract(supabase, contractId, firmId);

  if (format === 'pdf') {
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

    page.drawText(`CONTRACT ANALYSIS REPORT: ${contract.filename.toUpperCase()}`, {
      x: margin,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.3, 0.8),
    });
    y -= 25;

    addText(`Date: ${new Date().toLocaleDateString()}`, boldFont, 10, 14);
    addText(`File Size: ${(contract.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`, font, 10, 14);
    addText(`Total Pages: ${contract.pageCount ?? 'N/A'}`, font, 10, 14);
    addText(`Analysis Status: ${contract.status.toUpperCase()}`, font, 10, 14);
    y -= 20;

    if (annotations.length === 0) {
      addText('No annotations found for this contract.', font, 11, 16);
    } else {
      page.drawText('DETAILED ANNOTATIONS', {
        x: margin,
        y,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.3, 0.8),
      });
      y -= 18;

      for (const a of annotations) {
        if (y < margin + 60) {
          page = pdfDoc.addPage();
          y = height - 50;
        }

        const riskColor = a.riskLevel === 'critical' ? 'CRITICAL' : a.riskLevel.toUpperCase();
        addText(
          `Page ${a.pageNumber} | Type: ${a.clauseType.toUpperCase()} | Risk: ${riskColor}`,
          boldFont,
          10,
          14
        );
        if (a.citationRef) {
          addText(`Citation: ${a.citationRef}`, boldFont, 9, 13);
        }
        addText(`Quoted text: "${a.clauseText}"`, font, 9, 13);
        addText(`Explanation: ${a.explanation}`, font, 9, 13);
        if (a.suggestion) {
          addText(`Suggestion: ${a.suggestion}`, font, 9, 13);
        }
        y -= 12;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return { buffer: Buffer.from(pdfBytes), mimeType: 'application/pdf' };
  } else {
    // Generate DOCX
    const children: any[] = [
      new Paragraph({
        text: `Contract Analysis Report: ${contract.filename}`,
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Date: ', bold: true }),
          new TextRun(new Date().toLocaleDateString()),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'File Size: ', bold: true }),
          new TextRun(`${(contract.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Total Pages: ', bold: true }),
          new TextRun(String(contract.pageCount ?? 'N/A')),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Analysis Status: ', bold: true }),
          new TextRun(contract.status.toUpperCase()),
        ],
      }),
      new Paragraph({ text: '' }),
    ];

    if (annotations.length === 0) {
      children.push(new Paragraph({ text: 'No annotations found for this contract.' }));
    } else {
      children.push(
        new Paragraph({
          text: 'Detailed Annotations',
          heading: HeadingLevel.HEADING_2,
        })
      );

      for (const a of annotations) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Page ${a.pageNumber} | Clause: ${a.clauseType} | Risk: ${a.riskLevel.toUpperCase()}\n`,
                bold: true,
              }),
              a.citationRef ? new TextRun({ text: `Citation: ${a.citationRef}\n`, bold: true }) : new TextRun(''),
              new TextRun({ text: `Quoted Clause:\n`, italics: true }),
              new TextRun({ text: `"${a.clauseText}"\n`, italics: true }),
              new TextRun({ text: `Explanation:\n`, bold: true }),
              new TextRun({ text: `${a.explanation}\n` }),
              a.suggestion
                ? new TextRun({ text: `Suggestion:\n`, bold: true })
                : new TextRun(''),
              a.suggestion
                ? new TextRun({ text: `${a.suggestion}\n` })
                : new TextRun(''),
            ],
          })
        );
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

    const docxBuffer = await Packer.toBuffer(doc);
    return {
      buffer: docxBuffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
}
