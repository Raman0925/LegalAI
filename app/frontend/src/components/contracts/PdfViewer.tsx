'use client';

import { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfViewerProps {
  signedUrl: string;
  targetPage?: number;                 // jump to this page when annotation clicked
  onPageChange?: (page: number) => void;
}

export function PdfViewer({ signedUrl, targetPage, onPageChange }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    []
  );

  // Jump to target page when targetPage changes
  useEffect(() => {
    if (targetPage && targetPage !== currentPage && targetPage <= numPages && targetPage >= 1) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, numPages]);

  const goToPrev = () => {
    const p = Math.max(1, currentPage - 1);
    setCurrentPage(p);
    onPageChange?.(p);
  };

  const goToNext = () => {
    const p = Math.min(numPages, currentPage + 1);
    setCurrentPage(p);
    onPageChange?.(p);
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrev} disabled={currentPage <= 1}>
            ← Prev
          </Button>
          <span className="text-sm font-medium text-gray-600">
            Page {currentPage} of {numPages || '...'}
          </span>
          <Button variant="outline" size="sm" onClick={goToNext} disabled={currentPage >= numPages || numPages === 0}>
            Next →
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
            −
          </Button>
          <span className="text-xs text-gray-500 min-w-10 text-center font-mono">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setScale(s => Math.min(2.5, s + 0.2))}>
            +
          </Button>
        </div>
      </div>

      {/* PDF */}
      <div className="flex-1 overflow-auto flex justify-center bg-gray-100 p-4">
        <div className="inline-block max-h-full">
          <Document
            file={signedUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center p-12 text-gray-500 font-medium">
                <span className="animate-pulse">Loading PDF Document...</span>
              </div>
            }
            error={
              <div className="flex items-center justify-center p-12 text-red-500 font-medium">
                Failed to load PDF. Please make sure the file is valid.
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={false} // turned off standard annotation layer to avoid link block bugs
              className="shadow-md bg-white border border-gray-300 rounded"
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
