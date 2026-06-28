'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { api, API_BASE } from '@/lib/api';
import { createBrowserClient } from '@/lib/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ResearchMessage, ResearchCitation } from '@/types/research';
import {
  Send,
  Loader2,
  BookOpen,
  ArrowLeft,
  Search,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export default function ResearchSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [sessionTitle, setSessionTitle] = React.useState('Research Session');
  const [sessionQuery, setSessionQuery] = React.useState('');
  const [messages, setMessages] = React.useState<ResearchMessage[]>([]);
  const [citations, setCitations] = React.useState<ResearchCitation[]>([]);
  const [streamingText, setStreamingText] = React.useState('');
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [userProfile, setUserProfile] = React.useState({ fullName: '', email: '' });

  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    async function loadData() {
      if (!sessionId) return;
      try {
        // Load user profile
        const user = await api.auth.me();
        setUserProfile({ fullName: user.full_name || '', email: user.email });

        // Load historical session details
        const res = await api.research.getById(sessionId);
        setSessionTitle(res.session.title);
        setSessionQuery(res.session.query);
        setMessages(res.messages || []);
      } catch (err: any) {
        console.error('Failed to load session details:', err);
        toast({
          title: 'Session Error',
          description: err.message || 'Failed to fetch session messages.',
          variant: 'destructive',
        });
        router.push('/research');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [sessionId, router]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Consolidates citations across all messages for sidebar display
  const allCitations = React.useMemo(() => {
    const historical = messages
      .filter((m) => m.role === 'assistant')
      .flatMap((m) => m.citations || []);

    // Merge with current active streaming citations
    const combined = [...historical, ...citations];

    // Filter duplicates by citationIndex
    const seen = new Set<number>();
    return combined.filter((c) => {
      if (seen.has(c.citationIndex)) return false;
      seen.add(c.citationIndex);
      return true;
    }).sort((a, b) => a.citationIndex - b.citationIndex);
  }, [messages, citations]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || streaming) return;

    const queryText = input.trim();
    setInput('');
    setStreaming(true);
    setStreamingText('');
    setCitations([]);

    try {
      // 1. Add user message locally
      const tempUserMsg: ResearchMessage = {
        id: `temp-user-${Date.now()}`,
        sessionId,
        role: 'user',
        content: queryText,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      // 2. Fetch authenticated Supabase access token
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication expired. Please log in again.');
      }

      // 3. Initiate post stream fetch request
      const res = await fetch(`${API_BASE}/api/research/sessions/${sessionId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: queryText }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${await res.text()}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let streamBuffer = '';
      let streamCitations: ResearchCitation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            if (chunk.type === 'text') {
              fullText += chunk.text;
              setStreamingText(fullText);
            }
            if (chunk.type === 'citation') {
              const newCit = chunk.citation as ResearchCitation;
              streamCitations.push(newCit);
              setCitations((prev) => {
                if (prev.some((c) => c.citationIndex === newCit.citationIndex)) {
                  return prev;
                }
                return [...prev, newCit].sort((a, b) => a.citationIndex - b.citationIndex);
              });
            }
            if (chunk.type === 'error') {
              throw new Error(chunk.error || 'Stream error occurred.');
            }
            if (chunk.type === 'done') {
              // Reload session messages from backend to get verified database-persisted message history with real IDs
              const refreshed = await api.research.getById(sessionId);
              setMessages(refreshed.messages || []);
              setStreamingText('');
              setStreaming(false);
              return;
            }
          } catch (jsonErr) {
            // Skip malformed chunk parsing
          }
        }
      }
    } catch (err: any) {
      toast({
        title: 'Query Failed',
        description: err.message || 'Stream connection closed unexpectedly.',
        variant: 'destructive',
      });
      setStreaming(false);
      setStreamingText('');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
      <Sidebar
        active="research"
        userProfile={userProfile}
      />

      <main className="flex-1 flex flex-col md:flex-row min-h-0 bg-zinc-950">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <span className="text-zinc-400 text-sm">Loading research session...</span>
          </div>
        ) : (
          <>
            {/* Middle panel (Chat content) */}
            <div className="flex-1 flex flex-col min-h-0 border-r border-zinc-900 bg-zinc-950">
              {/* Header */}
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/30 flex items-center gap-4">
                <button
                  onClick={() => router.push('/research')}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <div className="min-w-0">
                  <h1 className="font-bold text-base text-white truncate">{sessionTitle}</h1>
                  <p className="text-[10px] text-zinc-500 truncate max-w-xl">
                    Query Context: {sessionQuery}
                  </p>
                </div>
              </div>

              {/* Chat Message Window */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
                <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl p-4 flex gap-3 text-xs leading-relaxed max-w-3xl">
                  <AlertCircle className="h-4.5 w-4.5 text-violet-400 shrink-0" />
                  <div className="text-zinc-400 space-y-1">
                    <p className="font-semibold text-zinc-300">Evidence-Based RAG Workspace</p>
                    <p>
                      This session queries ingested documents. The assistant must base all claims on source document chunks. Inline citations match the numbered sources in the sidebar.
                    </p>
                  </div>
                </div>

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-none'
                          : 'bg-zinc-900/60 border border-zinc-905 text-zinc-300 rounded-bl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {/* Live stream content */}
                {streamingText && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-900/60 border border-zinc-905 px-4 py-3 rounded-2xl rounded-bl-none text-zinc-300 max-w-2xl shadow-lg relative">
                      <p className="whitespace-pre-wrap">{streamingText}</p>
                      <span className="inline-block h-3.5 w-1.5 ml-1 bg-violet-400 animate-pulse align-middle" />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input Bar */}
              <div className="p-4 border-t border-zinc-900 bg-zinc-950">
                <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Search documents and ask a follow-up query..."
                    disabled={streaming}
                    className="flex-1 bg-zinc-900/60 border border-zinc-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || streaming}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 rounded-xl flex items-center justify-center disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-violet-500/10"
                  >
                    {streaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Right panel (Citations sidebar) */}
            <div className="w-full md:w-80 shrink-0 flex flex-col min-h-0 bg-zinc-900/10">
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/20">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-400" />
                  <span>References & Sources</span>
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {allCitations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <Search className="h-8 w-8 text-zinc-700 mb-3" />
                    <p className="text-xs text-zinc-500 leading-normal">
                      Citations and source chunks will appear here as response generation begins.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allCitations.map((c) => (
                      <div
                        key={c.citationIndex}
                        className="bg-zinc-900/40 border border-zinc-850 hover:border-zinc-800 rounded-xl p-4 space-y-2.5 transition-all duration-200"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            [{c.citationIndex}]
                          </span>
                          <span className="font-semibold text-xs text-zinc-200 truncate flex-1 block">
                            {c.documentName}
                          </span>
                        </div>

                        {c.pageNumber && (
                          <div className="text-[10px] text-zinc-500 font-medium">
                            Page {c.pageNumber}
                          </div>
                        )}

                        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans line-clamp-4 italic border-l-2 border-zinc-800 pl-2">
                          "{c.chunkPreview}"
                        </p>

                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold pt-1">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Verified</span>
                          </span>
                          <span>
                            Score: {Math.round(c.relevanceScore * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
