import { Loader2 } from 'lucide-react';
import type { DocumentRecord } from '@/lib/api';

const STATUS_CONFIG: Record<DocumentRecord['status'], { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  processing: {
    label: 'Processing',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  ready: { label: 'Ready', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  failed: { label: 'Failed', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

export function StatusBadge({ status }: { status: DocumentRecord['status'] }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border uppercase tracking-wide ${className}`}
    >
      {status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </span>
  );
}
