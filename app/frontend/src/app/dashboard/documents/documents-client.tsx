'use client';

import * as React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { UploadDropzone } from '@/components/documents/UploadDropzone';
import { DocumentTable } from '@/components/documents/DocumentTable';
import { DocumentDrawer } from '@/components/documents/DocumentDrawer';
import { DeleteConfirmModal } from '@/components/documents/DeleteConfirmModal';
import { api, type DocumentRecord } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface DocumentsClientProps {
  initialUser: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
}

const POLL_INTERVAL_MS = 3000;

export function DocumentsClient({ initialUser }: DocumentsClientProps) {
  const userProfile = {
    fullName: (initialUser.user_metadata?.full_name as string) || '',
    email: initialUser.email,
  };

  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedDocument, setSelectedDocument] = React.useState<DocumentRecord | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<DocumentRecord | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const loadDocuments = React.useCallback(async () => {
    try {
      const docs = await api.documents.list();
      setDocuments(docs);
    } catch (err: unknown) {
      toast({
        title: 'Failed to load documents',
        description: (err instanceof Error ? err.message : null) || 'Could not reach the document service.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDocuments();
  }, [loadDocuments]);

  // Poll only the documents still in flight; re-derive the watch list whenever
  // the *set* of in-flight ids changes rather than on every documents update,
  // otherwise every tick's setDocuments call would tear down and restart the timer.
  const pollingKey = documents
    .filter((doc) => doc.status === 'pending' || doc.status === 'processing')
    .map((doc) => doc.id)
    .join(',');

  React.useEffect(() => {
    if (!pollingKey) return;
    const ids = pollingKey.split(',');

    const interval = setInterval(async () => {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            return [id, await api.documents.getStatus(id)] as const;
          } catch {
            return null;
          }
        }),
      );

      setDocuments((prev) =>
        prev.map((doc) => {
          const match = results.find((r) => r && r[0] === doc.id);
          if (!match) return doc;
          const [, status] = match;
          return {
            ...doc,
            status: status.status,
            chunkCount: status.chunkCount,
            errorMsg: status.errorMsg,
          };
        }),
      );
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [pollingKey]);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await api.documents.remove(pendingDelete.id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== pendingDelete.id));
      if (selectedDocument?.id === pendingDelete.id) setSelectedDocument(null);
      toast({ title: 'Document deleted', description: `${pendingDelete.name} has been removed.` });
      setPendingDelete(null);
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: (err instanceof Error ? err.message : null) || 'Failed to delete document.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
      <Sidebar active="documents" userProfile={userProfile} />

      <main className="flex-1 flex flex-col min-h-0 bg-zinc-950">
        <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Document Library
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Upload contracts and filings to make them searchable across the AI assistant.
            </p>
          </div>

          <UploadDropzone onUploaded={loadDocuments} />

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading documents…</span>
            </div>
          ) : (
            <DocumentTable
              documents={documents}
              onSelect={setSelectedDocument}
              onDelete={setPendingDelete}
            />
          )}
        </div>
      </main>

      <DocumentDrawer document={selectedDocument} onClose={() => setSelectedDocument(null)} />

      {pendingDelete && (
        <DeleteConfirmModal
          documentName={pendingDelete.name}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
