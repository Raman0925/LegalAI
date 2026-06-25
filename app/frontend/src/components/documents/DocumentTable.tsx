import { Trash2, FileText, FileImage } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { DocumentRecord } from '@/lib/api';

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_ICON: Record<DocumentRecord['fileType'], typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  image: FileImage,
};

interface DocumentTableProps {
  documents: DocumentRecord[];
  onSelect: (doc: DocumentRecord) => void;
  onDelete: (doc: DocumentRecord) => void;
}

export function DocumentTable({ documents, onSelect, onDelete }: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center bg-zinc-900/10">
        <p className="text-sm text-zinc-500">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Size</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Chunks</th>
            <th className="px-4 py-3 font-semibold">Uploaded</th>
            <th className="px-4 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const Icon = TYPE_ICON[doc.fileType];
            return (
              <tr
                key={doc.id}
                onClick={() => onSelect(doc)}
                className="border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-900/40 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 max-w-xs">
                    <Icon className="h-4 w-4 text-violet-400 shrink-0" />
                    <span className="text-zinc-200 font-medium truncate">{doc.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-400 uppercase text-xs font-mono">
                  {doc.fileType}
                </td>
                <td className="px-4 py-3 text-zinc-400">{formatBytes(doc.sizeBytes)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-zinc-400">{doc.chunkCount}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(doc);
                    }}
                    className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer"
                    aria-label={`Delete ${doc.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
