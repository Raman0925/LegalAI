import { X } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { DocumentRecord } from '@/lib/api';

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentDrawerProps {
  document: DocumentRecord | null;
  onClose: () => void;
}

export function DocumentDrawer({ document, onClose }: DocumentDrawerProps) {
  if (!document) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-zinc-950 border-l border-zinc-800 h-full p-6 space-y-6 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-white break-words">{document.name}</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Status</span>
            <StatusBadge status={document.status} />
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Type</span>
            <span className="text-zinc-200 uppercase font-mono text-xs">{document.fileType}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Size</span>
            <span className="text-zinc-200">{formatBytes(document.sizeBytes)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Chunks indexed</span>
            <span className="text-zinc-200">{document.chunkCount}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Uploaded</span>
            <span className="text-zinc-200">{new Date(document.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500">Last updated</span>
            <span className="text-zinc-200">{new Date(document.updatedAt).toLocaleString()}</span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-500 block mb-1">Document ID</span>
            <span className="text-zinc-400 font-mono text-xs break-all">{document.id}</span>
          </div>

          {document.status === 'failed' && document.errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-rose-400 mb-1">Ingestion error</p>
              <p className="text-xs text-rose-300/90">{document.errorMsg}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
