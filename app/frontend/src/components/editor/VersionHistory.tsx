'use client';

import { useState, useEffect } from 'react';
import { DocumentVersion } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JSONContent } from '@tiptap/react';
import { History, Plus, RotateCcw, X, Loader2, Calendar } from 'lucide-react';

interface VersionHistoryProps {
  documentId: string;
  wordCount: number;
  editorContent: JSONContent;
  onRestore: (content: JSONContent) => void;
  onClose?: () => void;
}

import { getAuthHeaders } from '@/lib/api';

export function VersionHistory({
  documentId,
  wordCount,
  editorContent,
  onRestore,
  onClose,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<Omit<DocumentVersion, 'content'>[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState<string | null>(null);
  
  // Custom Label
  const [newLabel, setNewLabel] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);

  const fetchVersions = async () => {
    try {
      setLoadingList(true);
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/proxy?path=/editor/documents/${documentId}/versions`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVersions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    
    try {
      setSavingVersion(true);
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/proxy?path=/editor/documents/${documentId}/versions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          content: editorContent,
          wordCount,
          label: newLabel,
        }),
      });

      if (res.ok) {
        setNewLabel('');
        fetchVersions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    try {
      setLoadingRestore(versionId);
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/proxy?path=/editor/documents/${documentId}/versions/${versionId}`, {
        headers: authHeaders,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.version && data.version.content) {
          onRestore(data.version.content);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRestore(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l shadow-xl w-80 shrink-0">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4.5 w-4.5 text-indigo-600" />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Version History</h3>
            <p className="text-[10px] text-gray-500">Restore any previous snapshot</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4 text-gray-400" />
          </Button>
        )}
      </div>

      {/* Save Manual Snapshot Form */}
      <form onSubmit={handleSaveSnapshot} className="p-3 border-b bg-indigo-50/20 space-y-2">
        <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">
          Save manual snapshot
        </span>
        <div className="flex gap-1.5">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Before negotiations"
            className="text-xs h-8 focus-visible:ring-indigo-500 bg-white"
            disabled={savingVersion}
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 flex gap-1 items-center shrink-0"
            disabled={savingVersion || !newLabel.trim()}
          >
            {savingVersion ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </form>

      {/* Snapshots List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loadingList ? (
          <div className="flex items-center justify-center p-8 text-gray-400 text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading versions...
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center p-8">No saved versions found. Let the document auto-save, or save a manual snapshot.</p>
        ) : (
          versions.map((v) => {
            const formattedDate = new Date(v.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const formattedCalendar = new Date(v.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={v.id}
                className="p-3 border rounded-lg border-gray-200 bg-gray-50/40 hover:bg-white transition flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-gray-500 text-[10px]">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    <span>{formattedCalendar} at {formattedDate}</span>
                  </div>
                  <span className="text-[9px] font-mono text-gray-400 font-medium">
                    {v.wordCount} words
                  </span>
                </div>

                {v.label && (
                  <p className="text-xs font-bold text-gray-800 leading-tight">
                    {v.label}
                  </p>
                )}

                <Button
                  onClick={() => handleRestore(v.id)}
                  variant="outline"
                  size="sm"
                  className="w-full text-[10px] h-7 font-bold border-gray-300 text-indigo-700 bg-white hover:bg-indigo-50/20 flex gap-1 items-center justify-center"
                  disabled={loadingRestore !== null}
                >
                  {loadingRestore === v.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Restore Version
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
