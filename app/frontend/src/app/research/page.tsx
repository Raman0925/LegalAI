'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ResearchSession } from '@/types/research';
import {
  Search,
  Plus,
  Loader2,
  BookOpen,
  Calendar,
  MessageSquareCode,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function ResearchPage() {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<ResearchSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newTitle, setNewTitle] = React.useState('');
  const [newQuery, setNewQuery] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [userProfile, setUserProfile] = React.useState({ fullName: '', email: '' });

  React.useEffect(() => {
    async function loadData() {
      try {
        // Fetch user profile for sidebar
        const user = await api.auth.me();
        setUserProfile({ fullName: user.full_name || '', email: user.email });

        // Fetch research sessions
        const res = await api.research.list();
        setSessions(res.sessions || []);
      } catch (err: any) {
        console.error('Failed to load research data:', err);
        toast({
          title: 'Connection Error',
          description: 'Could not load your research sessions.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newQuery.trim() || creating) return;

    setCreating(true);
    try {
      const data = await api.research.create({
        title: newTitle.trim(),
        query: newQuery.trim(),
      });
      toast({
        title: 'Session Created',
        description: 'Launching research workspace...',
      });
      router.push(`/research/${data.session.id}`);
    } catch (err: any) {
      toast({
        title: 'Creation Failed',
        description: err.message || 'Failed to start research session.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
      <Sidebar
        active="research"
        userProfile={userProfile}
      />

      <main className="flex-1 flex flex-col min-h-0 bg-zinc-950">
        <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Legal Research Sessions
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Conduct deep query analysis across documents with source-cited RAG streaming.
              </p>
            </div>
          </div>

          {/* New Session Card */}
          <div className="relative group bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-violet-600/5 blur-3xl" />
            <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-indigo-600/5 blur-3xl" />
            <div className="relative space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <span>Start New Research Session</span>
              </h2>

              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Research Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Liability scope in sub-contracting agreements"
                    disabled={creating}
                    className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all placeholder-zinc-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Initial Query / Legal Question
                  </label>
                  <textarea
                    value={newQuery}
                    onChange={(e) => setNewQuery(e.target.value)}
                    placeholder="Describe your query in detail. Our search algorithm will scan vector chunks, retrieve evidence, and rerank using Cohere..."
                    disabled={creating}
                    rows={3}
                    className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl p-4 text-sm text-white focus:outline-none transition-all placeholder-zinc-700 resize-none"
                    required
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={creating || !newTitle.trim() || !newQuery.trim()}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-violet-500/10 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Initializing Workspace...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Start Research</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Session List */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">
              Previous Research Sessions
            </h3>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <span className="text-sm">Loading historical sessions...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center p-8 bg-zinc-900/10">
                <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h4 className="font-semibold text-zinc-300">No active research sessions</h4>
                <p className="text-xs text-zinc-500 max-w-xs mt-1.5 leading-relaxed">
                  Start your first research session above to query legal documents and extract inline citations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => router.push(`/research/${session.id}`)}
                    className="group bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 rounded-xl p-5 transition-all duration-200 cursor-pointer flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-violet-500/5"
                  >
                    <div className="space-y-2 overflow-hidden flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <MessageSquareCode className="h-4 w-4 text-violet-400 shrink-0" />
                        <h4 className="font-semibold text-sm text-zinc-200 truncate group-hover:text-white">
                          {session.title}
                        </h4>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-2 pr-6">
                        {session.query}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(session.createdAt)}</span>
                        </span>
                        <span className="capitalize px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/30">
                          {session.status}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-zinc-500 group-hover:text-white transition-colors">
                      <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
