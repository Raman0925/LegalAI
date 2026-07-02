'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';
import { Contract } from '@/types/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, UploadCloud, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

import { getAuthHeaders } from '@/lib/api';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/proxy?path=/contracts', {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to fetch contracts');
      const data = await response.json();
      setContracts(data.contracts || []);
    } catch (err) {
      console.error(err);
      setError('Could not load contracts. Please check your login session.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Handle PDF uploads
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders } as Record<string, string>;
      delete headers['Content-Type'];

      const response = await fetch('/api/proxy?path=/contracts/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      await fetchContracts();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'File upload failed. Make sure the file is a PDF under 20MB.');
    } finally {
      setUploading(false);
    }
  }, [fetchContracts]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleStartAnalysis = async (contractId: string) => {
    // Redirect to the detail page, which will trigger and show the analysis stream automatically!
    window.location.href = `/contracts/${contractId}?start_analysis=true`;
  };

  const getStatusBadge = (status: Contract['status']) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Ready</Badge>;
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex gap-1 items-center">
            <Loader2 className="h-3 w-3 animate-spin" /> Analyzing
          </Badge>
        );
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Uploaded</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Contract Reviewer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload commercial contracts to extract clauses, review risk items, and perform interactive analysis.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex gap-3 text-red-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`mb-10 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300 hover:border-blue-400 bg-white shadow-sm'
        } ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center">
          {uploading ? (
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
          ) : (
            <UploadCloud className={`h-12 w-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
          )}
          {uploading ? (
            <h3 className="font-semibold text-gray-800 text-sm">Uploading and registering PDF...</h3>
          ) : isDragActive ? (
            <h3 className="font-semibold text-blue-600 text-sm">Drop the contract here!</h3>
          ) : (
            <h3 className="font-semibold text-gray-800 text-sm">
              Drag & drop a contract PDF, or <span className="text-blue-600">browse files</span>
            </h3>
          )}
          <p className="text-xs text-gray-400 mt-1">Accepts PDF files only, up to 20MB.</p>
        </div>
      </div>

      {/* Contracts Table/List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900 text-lg">Your Uploaded Contracts</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-gray-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading contracts...</span>
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-sm">No contracts uploaded yet</h3>
            <p className="text-xs text-gray-400 mt-1">Upload a PDF above to begin contract analysis.</p>
          </div>
        ) : (
          <div className="divide-y">
            {contracts.map((contract) => (
              <div key={contract.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm break-all">{contract.filename}</h3>
                    <div className="flex flex-wrap gap-2 items-center text-xs text-gray-400 mt-1">
                      <span>{(contract.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                      <span>•</span>
                      <span>{contract.pageCount !== null ? `${contract.pageCount} pages` : 'Pages pending'}</span>
                      <span>•</span>
                      <span>Uploaded {new Date(contract.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(contract.status)}

                  {contract.status === 'uploaded' && (
                    <Button
                      onClick={() => handleStartAnalysis(contract.id)}
                      size="sm"
                      className="font-semibold text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Start Analysis
                    </Button>
                  )}

                  {contract.status === 'failed' && (
                    <Button
                      onClick={() => handleStartAnalysis(contract.id)}
                      size="sm"
                      variant="outline"
                      className="font-semibold text-xs h-8 border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Retry Analysis
                    </Button>
                  )}

                  {contract.status === 'processing' && (
                    <Link href={`/contracts/${contract.id}`} passHref legacyBehavior>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-semibold text-xs h-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        View Progress
                      </Button>
                    </Link>
                  )}

                  {contract.status === 'ready' && (
                    <Link href={`/contracts/${contract.id}`} passHref legacyBehavior>
                      <Button
                        size="sm"
                        className="font-semibold text-xs h-8 bg-gray-900 hover:bg-gray-800 text-white flex gap-1 items-center"
                      >
                        Open Review <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
