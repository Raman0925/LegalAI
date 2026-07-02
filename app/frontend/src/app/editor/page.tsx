'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LegalDocument } from '@/types/editor';
import { MatterRecord as Matter } from '@/lib/api';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  FolderOpen,
  Loader2,
  ExternalLink,
} from 'lucide-react';

import { getAuthHeaders } from '@/lib/api';

export default function DocumentListPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedMatterId, setSelectedMatterId] = useState('');
  const [creating, setCreating] = useState(false);

  // Profile context dummy
  const userProfile = { fullName: 'Legal AI Professional', email: 'lawyer@firm.com' };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/proxy?path=/editor/documents', {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatters = async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/proxy?path=/matters', {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setMatters(data.matters || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchMatters();
  }, []);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreating(true);
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/proxy?path=/editor/documents', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: newTitle,
          matterId: selectedMatterId || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.document && data.document.id) {
          router.push(`/editor/${data.document.id}`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
      setShowCreateModal(false);
      setNewTitle('');
      setSelectedMatterId('');
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <Sidebar active="contracts" userProfile={userProfile} />

      <main className="flex-1 overflow-y-auto bg-zinc-900/40 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Drafting Editor
              </h1>
              <p className="text-sm text-zinc-400">
                Draft, edit, and version legal documents with inline AI suggestions.
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-violet-500/10 flex items-center gap-2"
            >
              <Plus className="h-4.5 w-4.5" /> New Document
            </Button>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search documents by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus-visible:ring-violet-500"
            />
          </div>

          {/* Documents Table / Cards */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-400 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <span className="text-sm font-medium">Loading documents...</span>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center p-16 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
              <FileText className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
              <h3 className="text-base font-bold text-zinc-300">No documents found</h3>
              <p className="text-xs text-zinc-500 mt-1">Get started by creating a new document template.</p>
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="outline"
                className="mt-4 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
              >
                Create Document
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => {
                const formattedDate = new Date(doc.updatedAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                const matchedMatter = matters.find((m) => m.id === doc.matterId);

                return (
                  <div
                    key={doc.id}
                    className="group border border-zinc-800/80 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700/80 transition duration-200 p-5 flex flex-col justify-between gap-4 shadow-lg"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-zinc-100 group-hover:text-white transition line-clamp-2 leading-snug">
                          {doc.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px] bg-zinc-950 text-zinc-400 border-zinc-800"
                        >
                          {doc.status}
                        </Badge>
                      </div>

                      {matchedMatter && (
                        <div className="flex items-center gap-1 text-[11px] text-violet-400 mt-1.5 font-medium">
                          <FolderOpen className="h-3 w-3 shrink-0" />
                          <span className="truncate">{matchedMatter.title}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3">
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> {formattedDate}
                        </span>
                        <span>•</span>
                        <span>{doc.wordCount} words</span>
                      </div>

                      <Link
                        href={`/editor/${doc.id}`}
                        className="text-xs font-bold text-violet-400 group-hover:text-violet-300 flex items-center gap-1 transition"
                      >
                        Edit <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Creation Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="font-bold text-white text-base">Create New Document</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-zinc-500 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateDocument} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Document Title</label>
                    <Input
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Master Services Agreement"
                      className="bg-zinc-950 border-zinc-800 text-white focus-visible:ring-violet-500 placeholder-zinc-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Linked Matter (Optional)</label>
                    <select
                      value={selectedMatterId}
                      onChange={(e) => setSelectedMatterId(e.target.value)}
                      className="w-full text-sm bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-md p-2 focus:outline-none focus:border-violet-500"
                    >
                      <option value="">Unlinked / General</option>
                      {matters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                      onClick={() => setShowCreateModal(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-4"
                      disabled={creating || !newTitle.trim()}
                    >
                      {creating ? 'Creating...' : 'Create & Edit'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// Simple X icon helper
function X(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
