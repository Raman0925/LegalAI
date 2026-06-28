import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document as DocxDocument, Paragraph, TextRun, Packer, HeadingLevel } from 'docx';
import { JSONContent } from './editor.types.js';

interface DocxSection {
  type: 'heading' | 'paragraph' | 'list';
  level?: number;
  text: string;
  items?: string[];
}

/**
 * Convert TipTap JSONContent to plain text for export.
 * Walks the node tree recursively.
 */
export function tiptapToPlainText(content: JSONContent): string {
  if (!content || !content.content) return '';

  const lines: string[] = [];

  function walk(node: JSONContent) {
    if (!node) return;

    if (node.type === 'text') {
      lines.push(node.text ?? '');
      return;
    }

    if (node.type === 'hardBreak') {
      lines.push('\n');
      return;
    }

    const isBlock = [
      'paragraph', 'heading', 'bulletList',
      'orderedList', 'listItem', 'blockquote',
    ].includes(node.type ?? '');

    (node.content ?? []).forEach(walk);

    if (isBlock) lines.push('\n');
  }

  (content.content ?? []).forEach(walk);
  return lines.join('').trim();
}

/**
 * Convert TipTap JSONContent to structured sections for DOCX export.
 */
export function tiptapToDocxSections(content: JSONContent): DocxSection[] {
  const sections: DocxSection[] = [];
  if (!content?.content) return sections;

  for (const node of content.content) {
    if (node.type === 'heading') {
      sections.push({
        type: 'heading',
        level: node.attrs?.level ?? 1,
        text: (node.content ?? []).map(n => n.text ?? '').join(''),
      });
    } else if (node.type === 'paragraph') {
      const text = (node.content ?? []).map(n => n.text ?? '').join('');
      if (text.trim()) sections.push({ type: 'paragraph', text });
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const items = (node.content ?? []).map(li =>
        (li.content ?? [])
          .flatMap(p => p.content ?? [])
          .map(n => n.text ?? '')
          .join('')
      );
      sections.push({ type: 'list', text: '', items });
    }
  }

  return sections;
}

export async function exportDocument(
  title: string,
  content: JSONContent,
  format: 'pdf' | 'docx'
): Promise<Buffer> {
  const sections = tiptapToDocxSections(content);

  if (format === 'pdf') {
    return generatePdf({ title, sections });
  }

  return generateDocx({ title, sections });
}

// ─── Document Generators ──────────────────────────────────────

async function generatePdf(details: { title: string; sections: DocxSection[] }): Promise<Buffer> {
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

  // Draw Title
  page.drawText(details.title.toUpperCase(), {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.4),
  });
  y -= 30;

  for (const s of details.sections) {
    if (y < margin + 40) {
      page = pdfDoc.addPage();
      y = height - 50;
    }

    if (s.type === 'heading') {
      const size = s.level === 1 ? 14 : 12;
      y -= 10;
      page.drawText(s.text, {
        x: margin,
        y,
        size,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= size + 6;
    } else if (s.type === 'paragraph') {
      addText(s.text, font, 10, 14);
      y -= 8;
    } else if (s.type === 'list' && s.items) {
      for (const item of s.items) {
        addText(`- ${item}`, font, 10, 14);
      }
      y -= 8;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function generateDocx(details: { title: string; sections: DocxSection[] }): Promise<Buffer> {
  const children: any[] = [
    new Paragraph({
      text: details.title,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({ text: '' }),
  ];

  for (const s of details.sections) {
    if (s.type === 'heading') {
      const heading = s.level === 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      children.push(
        new Paragraph({
          text: s.text,
          heading,
        })
      );
    } else if (s.type === 'paragraph') {
      children.push(
        new Paragraph({
          text: s.text,
        })
      );
    } else if (s.type === 'list' && s.items) {
      for (const item of s.items) {
        children.push(
          new Paragraph({
            text: `- ${item}`,
          })
        );
      }
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
