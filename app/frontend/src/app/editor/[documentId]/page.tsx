'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
import { VersionHistory } from '@/components/editor/VersionHistory';
import { ClauseLibrary } from '@/components/editor/ClauseLibrary';
import { LegalDocument } from '@/types/editor';
import { JSONContent, Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Download, History, ListTodo, Loader2 } from 'lucide-react';

import { getAuthHeaders } from '@/lib/api';

type PanelView = 'none' | 'versions' | 'clauses';

export default function EditorDetailPage() {
  const router = useRouter();
  const { documentId } = useParams<{ documentId: string }>();
  const [legalDoc, setLegalDoc] = useState<LegalDocument | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [panelView, setPanelView] = useState<PanelView>('none');
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  // Fetch document details on mount
  useEffect(() => {
    const controller = new AbortController();
    const fetchDocument = async (signal: AbortSignal) => {
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`/api/proxy?path=/editor/documents/${documentId}`, {
          headers: authHeaders,
          signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (signal.aborted) return;
          setLegalDoc(data.document);
          setWordCount(data.document.wordCount || 0);
        } else {
          if (!signal.aborted) router.push('/editor');
        }
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return;
        console.error(err);
        if (!signal.aborted) router.push('/editor');
      }
    };
    fetchDocument(controller.signal);
    return () => {
      controller.abort();
    };
  }, [documentId, router]);

  const handleSave = async (content: JSONContent, words: number) => {
    setSaveStatus('saving');
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/proxy?path=/editor/documents/${documentId}`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            content,
            wordCount: words,
            title: legalDoc?.title,
            status: legalDoc?.status,
          }),
        }
      );

      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('unsaved');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('unsaved');
    }
  };

  const handleStatusChange = async (newStatus: LegalDocument['status']) => {
    if (!legalDoc) return;
    setLegalDoc({ ...legalDoc, status: newStatus });
    setSaveStatus('saving');
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/proxy?path=/editor/documents/${documentId}`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            content: activeEditor ? activeEditor.getJSON() : legalDoc.content,
            wordCount,
            title: legalDoc.title,
            status: newStatus,
          }),
        }
      );
      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('unsaved');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('unsaved');
    }
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/proxy?path=/editor/documents/${documentId}/export`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ format }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${(legalDoc?.title || 'document').replace(/[^a-z0-9]/gi, '_')}.${format}`;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestoreVersion = async (content: JSONContent) => {
    if (!legalDoc || !activeEditor) return;
    activeEditor.commands.setContent(content);
    setLegalDoc({ ...legalDoc, content });
    setPanelView('none');
    // Immediate save trigger
    await handleSave(content, wordCount);
  };

  if (!legalDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-400 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <span className="text-sm">Loading workspace...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden text-zinc-200">
      
      {/* Header Panel */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/editor')}
            className="text-zinc-400 hover:text-white flex gap-1 items-center px-2 py-1"
          >
            <ChevronLeft className="h-4 w-4" /> Documents
          </Button>
          <div className="h-4 w-px bg-zinc-800" />
          <h1 className="font-extrabold text-white text-base truncate max-w-sm" title={legalDoc.title}>
            {legalDoc.title}
          </h1>
          <select
            value={legalDoc.status}
            onChange={(e) => handleStatusChange(e.target.value as LegalDocument['status'])}
            className="text-xs bg-zinc-950 border border-zinc-800 text-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-violet-500 capitalize"
          >
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="final">Final</option>
            <option value="archived">Archived</option>
          </select>

          <span
            className={`text-xs font-semibold ${
              saveStatus === 'saved' ? 'text-emerald-500' :
              saveStatus === 'saving' ? 'text-sky-500' : 'text-rose-500'
            }`}
          >
            {saveStatus === 'saved' ? '✓ Saved' :
             saveStatus === 'saving' ? 'Saving...' : '⚠ Unsaved'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelView(v => v === 'clauses' ? 'none' : 'clauses')}
            className={`text-xs flex gap-1 items-center px-3 py-1.5 rounded-lg border border-zinc-800/80 ${
              panelView === 'clauses' ? 'bg-zinc-800 text-white border-zinc-700' : 'text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" /> Clause Library
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelView(v => v === 'versions' ? 'none' : 'versions')}
            className={`text-xs flex gap-1 items-center px-3 py-1.5 rounded-lg border border-zinc-800/80 ${
              panelView === 'versions' ? 'bg-zinc-800 text-white border-zinc-700' : 'text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <History className="h-3.5 w-3.5" /> History
          </Button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('docx')}
            className="text-xs h-8 border-zinc-800 text-zinc-300 hover:bg-zinc-900 flex gap-1 items-center"
          >
            <Download className="h-3.5 w-3.5" /> DOCX
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            className="text-xs h-8 border-zinc-800 text-zinc-300 hover:bg-zinc-900 flex gap-1 items-center"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </header>

      {/* Editor & Side Panels Split layout */}
      <div className="flex-1 flex overflow-hidden bg-zinc-900/10">
        <div className="flex-1 overflow-hidden p-6">
          <TipTapEditor
            documentId={documentId}
            initialContent={legalDoc.content}
            title={legalDoc.title}
            onSave={handleSave}
            onWordCountChange={setWordCount}
            onEditorReady={setActiveEditor}
          />
        </div>

        {/* Version Snapshots Panel */}
        {panelView === 'versions' && (
          <div className="border-l border-zinc-800 h-full">
            <VersionHistory
              documentId={documentId}
              wordCount={wordCount}
              editorContent={activeEditor ? activeEditor.getJSON() : legalDoc.content}
              onRestore={handleRestoreVersion}
              onClose={() => setPanelView('none')}
            />
          </div>
        )}

        {/* Phase 6 Clause Pickers Panel */}
        {panelView === 'clauses' && (
          <div className="border-l border-zinc-800 h-full">
            <ClauseLibrary
              editor={activeEditor}
              onClose={() => setPanelView('none')}
            />
          </div>
        )}
      </div>

    </div>
  );
}
