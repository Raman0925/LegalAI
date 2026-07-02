'use client';

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { ContractAnnotation, ContractWithUrl } from '@/types/contracts';
import { PdfViewer } from '@/components/contracts/PdfViewer';
import { AnnotationSidebar } from '@/components/contracts/AnnotationSidebar';
import { ClausePanel } from '@/components/contracts/ClausePanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, FileDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api';

interface ContractPageProps {
  params: Promise<{ contractId: string }>;
}

export default function ContractReviewPage({ params }: ContractPageProps) {
  const { contractId } = use(params);

  const [contract, setContract] = useState<ContractWithUrl | null>(null);
  const [annotations, setAnnotations] = useState<ContractAnnotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<ContractAnnotation | null>(null);
  
  const [activePage, setActivePage] = useState(1);
  const [targetPage, setTargetPage] = useState<number | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const hasTriggeredAnalysis = useRef(false);

  // Load contract info & initial annotations
  const loadContractData = async (signal: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const authHeaders = await getAuthHeaders();

      // Get contract details (with signed URL)
      const res = await fetch(`/api/proxy?path=/contracts/${contractId}`, {
        headers: authHeaders,
        signal,
      });
      if (!res.ok) throw new Error('Contract not found or session expired');
      const data = await res.json();
      if (signal.aborted) return;
      const contractData: ContractWithUrl = data.contract;
      setContract(contractData);

      // Get annotations
      const annRes = await fetch(`/api/proxy?path=/contracts/${contractId}/annotations`, {
        headers: authHeaders,
        signal,
      });
      if (annRes.ok) {
        const annData = await annRes.json();
        if (signal.aborted) return;
        setAnnotations(annData.annotations || []);
      }

      // Automatically trigger analysis if requested or if status is not ready/failed
      const searchParams = new URLSearchParams(window.location.search);
      const triggerQuery = searchParams.get('start_analysis') === 'true';

      if ((triggerQuery || contractData.status === 'uploaded' || contractData.status === 'processing') && !hasTriggeredAnalysis.current) {
        startAnalysis(signal);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError('Could not load contract details.');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadContractData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [contractId]);

  // SSE analysis stream
  const startAnalysis = async (signal?: AbortSignal) => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisProgress(5);
    setAnalysisMessage('Initializing connection...');
    hasTriggeredAnalysis.current = true;

    // Reset annotations before starting
    setAnnotations([]);
    setSelectedAnnotation(null);

    const ssePath = `/api/proxy?path=/contracts/${contractId}/analyze`;
    
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(ssePath, {
        method: 'POST',
        headers: authHeaders,
        signal,
      });
      if (!response.ok) throw new Error('Failed to connect to analysis stream');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');

      let done = false;
      let partialLine = '';

      while (!done && (!signal || !signal.aborted)) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          const lines = (partialLine + chunk).split('\n\n');
          partialLine = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'progress') {
                  setAnalysisProgress(parsed.progress ?? 0);
                  setAnalysisMessage(parsed.message ?? 'Analyzing...');
                } else if (parsed.type === 'annotation') {
                  setAnnotations((prev) => {
                    // Avoid duplicate annotations
                    if (prev.some((a) => a.id === parsed.annotation.id)) return prev;
                    return [...prev, parsed.annotation].sort((a, b) => a.pageNumber - b.pageNumber);
                  });
                } else if (parsed.type === 'done') {
                  setAnalyzing(false);
                  setAnalysisProgress(100);
                  setAnalysisMessage('Complete!');
                  // Refresh contract info to update status to ready
                  const latestAuthHeaders = await getAuthHeaders();
                  const cRes = await fetch(`/api/proxy?path=/contracts/${contractId}`, {
                    headers: latestAuthHeaders,
                    signal,
                  });
                  if (cRes.ok) {
                    const cData = await cRes.json();
                    if (!signal || !signal.aborted) {
                      setContract(cData.contract);
                    }
                  }
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error || 'AI analysis failed');
                }
              } catch (e) {
                // ignore syntax parsing errors for partial lines
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message || 'AI analysis failed or stream disconnected.');
      setAnalyzing(false);
    }
  };

  // Click on annotation jumps to page
  const handleSelectAnnotation = (annotation: ContractAnnotation) => {
    setSelectedAnnotation(annotation);
    setTargetPage(annotation.pageNumber);
    setActivePage(annotation.pageNumber);
  };

  // Export report
  const handleExport = async (format: 'pdf' | 'docx') => {
    try {
      const authHeaders = await getAuthHeaders();
      const exportUrl = `/api/proxy?path=/contracts/${contractId}/export?format=${format}`;
      const response = await fetch(exportUrl, {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract-review-${contractId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Failed to download report.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-gray-500 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm font-semibold">Loading contract review workspace...</span>
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center bg-white p-8 border rounded-xl shadow-sm">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4 animate-bounce" />
        <h2 className="text-lg font-bold text-gray-900">Workspace Load Error</h2>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
        <Link href="/contracts" passHref legacyBehavior>
          <Button className="mt-6 font-semibold" size="sm">
            Return to Contracts List
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-full overflow-hidden">
      {/* Workspace Header */}
      <div className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/contracts" passHref legacyBehavior>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Back to contracts list">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-gray-900 text-sm max-w-xs md:max-w-md truncate" title={contract?.filename}>
              {contract?.filename}
            </h1>
            {contract && (
              <Badge variant={contract.status === 'ready' ? 'secondary' : 'default'} className="text-[10px] uppercase font-bold py-0.5 px-1.5">
                {contract.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {contract?.status === 'ready' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                className="h-8 px-3 text-xs font-semibold text-gray-700 flex gap-1 items-center"
              >
                <FileDown className="h-3.5 w-3.5 text-red-600" /> Export PDF Summary
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('docx')}
                className="h-8 px-3 text-xs font-semibold text-gray-700 flex gap-1 items-center"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" /> Export Word Summary
              </Button>
            </>
          )}

          {contract?.status !== 'ready' && !analyzing && (
            <Button
              size="sm"
              onClick={() => startAnalysis()}
              className="h-8 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex gap-1.5 items-center"
            >
              <RefreshCw className="h-3 w-3" /> Run AI Analysis
            </Button>
          )}
        </div>
      </div>

      {/* Main Workspace Workspace */}
      <div className="flex-1 flex overflow-hidden bg-gray-50">
        {/* Left Pane - PDF Viewer (60% width) */}
        <div className="w-[58%] h-full p-4 flex flex-col overflow-hidden">
          {contract && (
            <PdfViewer
              signedUrl={contract.signedUrl}
              targetPage={targetPage}
              onPageChange={(page) => {
                setActivePage(page);
                // Clear selected annotation if user manually changes pages away from it
                if (selectedAnnotation && selectedAnnotation.pageNumber !== page) {
                  setSelectedAnnotation(null);
                }
              }}
            />
          )}
        </div>

        {/* Right Pane - Sidebar Panels (42% width) */}
        <div className="w-[42%] h-full p-4 pl-0 flex flex-col gap-4 overflow-hidden">
          {/* Top Panel - Risk Annotations */}
          <div className="flex-[6] min-h-0">
            <AnnotationSidebar
              annotations={annotations}
              selectedId={selectedAnnotation?.id || null}
              onSelect={handleSelectAnnotation}
              loading={analyzing}
              progress={analysisProgress}
            />
          </div>

          {/* Bottom Panel - Clause Follow-up Q&A */}
          <div className="flex-[4] min-h-0">
            <ClausePanel
              contractId={contractId}
              selectedAnnotation={selectedAnnotation}
              activePage={activePage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
