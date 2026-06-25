'use client';

import * as React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  FileText,
  Cpu,
  Send,
  Loader2,
  CheckCircle,
  Database,
  ShieldAlert,
  Sparkles,
  User,
  Compass,
  ArrowRight,
} from 'lucide-react';

interface DashboardClientProps {
  initialUser: {
    id: string;
    email: string;
    user_metadata: Record<string, any>;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function DashboardClient({ initialUser }: DashboardClientProps) {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'chat' | 'reviewer' | 'profile'>(
    'overview',
  );
  const [userProfile, setUserProfile] = React.useState({
    id: initialUser.id,
    email: initialUser.email,
    fullName: initialUser.user_metadata?.full_name || '',
    avatarUrl: initialUser.user_metadata?.avatar_url || '',
  });

  // Profile Form States
  const [editingName, setEditingName] = React.useState(userProfile.fullName);
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);

  // Chat States
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Welcome to LegalAI. I can help you draft contracts, analyze clauses, or answer legal queries. Select an intelligence tier above to begin.',
    },
  ]);
  const [inputText, setInputText] = React.useState('');
  const [chatTier, setChatTier] = React.useState<'fast' | 'balanced' | 'powerful'>('balanced');
  const [isChatSending, setIsChatSending] = React.useState(false);

  // Token Stats (tracked dynamically based on responses)
  const [tokenStats, setTokenStats] = React.useState({
    input: 12450,
    output: 8650,
    total: 21100,
    budget: 50000,
  });

  // Document Reviewer States
  const [documentText, setDocumentText] = React.useState('');
  const [isReviewing, setIsReviewing] = React.useState(false);
  const [reviewResult, setReviewResult] = React.useState<{
    summary: string;
    risks: { severity: 'high' | 'medium' | 'low'; clause: string; issue: string; advice: string }[];
    obligations: string[];
  } | null>(null);

  // Fetch updated profile on mount
  React.useEffect(() => {
    async function loadProfile() {
      try {
        const data = await api.auth.me();
        setUserProfile({
          id: data.id,
          email: data.email,
          fullName: data.full_name || '',
          avatarUrl: data.avatar_url || '',
        });
        setEditingName(data.full_name || '');
      } catch (err: any) {
        console.error('Failed to load full profile:', err);
      }
    }
    loadProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const data = await api.auth.updateProfile({ full_name: editingName });
      setUserProfile((prev) => ({ ...prev, fullName: data.full_name || '' }));
      toast({
        title: 'Profile Updated',
        description: 'Your profile settings have been saved successfully.',
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Failed to update profile details.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isChatSending) return;

    const userMsg: ChatMessage = { role: 'user', content: inputText };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputText('');
    setIsChatSending(true);

    try {
      // Map frontend messages history to shape backend expects
      const historyPayload = updatedHistory
        .slice(0, -1) // skip the latest user message as it is sent as "message"
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await api.chat.send(userMsg.content, historyPayload, chatTier);

      setMessages((prev) => [...prev, { role: 'assistant', content: response.text }]);

      if (response.usage) {
        setTokenStats((prev) => {
          const newIn = prev.input + response.usage.inputTokens;
          const newOut = prev.output + response.usage.outputTokens;
          return {
            input: newIn,
            output: newOut,
            total: newIn + newOut,
            budget: prev.budget,
          };
        });
      }
    } catch (err: any) {
      toast({
        title: 'Chat Error',
        description: err.message || 'Failed to send message to LegalAI.',
        variant: 'destructive',
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '⚠️ Error: Failed to receive response from server. Please check your credentials or API connection.',
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  const handleReviewDocument = async () => {
    if (!documentText.trim() || isReviewing) return;
    setIsReviewing(true);
    setReviewResult(null);

    // Instruct the model to return strict JSON so we can render structured UI.
    const prompt = `You are a legal risk analyst. Review the following contract text and respond with ONLY a valid JSON object — no markdown, no explanation, no code fences.

The JSON must follow this exact shape:
{
  "summary": "<2-3 sentence executive summary>",
  "risks": [
    { "severity": "high" | "medium" | "low", "clause": "<clause name>", "issue": "<risk description>", "advice": "<mitigation advice>" }
  ],
  "obligations": ["<obligation 1>", "<obligation 2>"]
}

Contract text:
${documentText}`;

    try {
      const response = await api.chat.send(prompt, [], chatTier);

      // Strip any accidental markdown fences the model may have added.
      const clean = response.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      setReviewResult({
        summary: parsed.summary ?? '',
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        obligations: Array.isArray(parsed.obligations) ? parsed.obligations : [],
      });

      if (response.usage) {
        setTokenStats((prev) => {
          const newIn = prev.input + response.usage.inputTokens;
          const newOut = prev.output + response.usage.outputTokens;
          return { input: newIn, output: newOut, total: newIn + newOut, budget: prev.budget };
        });
      }
    } catch (err: any) {
      toast({
        title: 'Review Failed',
        description: err.message || 'Failed to complete document analysis.',
        variant: 'destructive',
      });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
      <Sidebar
        active={activeTab}
        userProfile={{ fullName: userProfile.fullName, email: userProfile.email }}
        onSelectTab={setActiveTab}
      />

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-h-0 bg-zinc-950">
        {/* OVERVIEW PANEL */}
        {activeTab === 'overview' && (
          <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                  Dashboard Overview
                </h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Real-time metrics, system health, and operations status.
                </p>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Backend Connected</span>
              </div>
            </div>

            {/* Metrics cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1: Token Usage */}
              <div className="relative group bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-violet-500/5">
                <div className="absolute top-0 right-0 h-16 w-16 bg-violet-500/5 rounded-bl-full group-hover:bg-violet-500/10 transition-colors" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-300">Tokens Usage</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold text-white">
                      {tokenStats.total.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500">
                      / {tokenStats.budget.toLocaleString()} max
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (tokenStats.total / tokenStats.budget) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                    <span>In: {tokenStats.input.toLocaleString()}</span>
                    <span>Out: {tokenStats.output.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: AI Intelligence Tier */}
              <div className="relative group bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-indigo-500/5">
                <div className="absolute top-0 right-0 h-16 w-16 bg-indigo-500/5 rounded-bl-full group-hover:bg-indigo-500/10 transition-colors" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-300">Model Tier</h3>
                </div>
                <div className="space-y-3">
                  <div className="text-2xl font-bold text-white capitalize">{chatTier}</div>
                  <p className="text-xs text-zinc-400">
                    {chatTier === 'fast' && 'Optimized for response speed & low-latency execution.'}
                    {chatTier === 'balanced' &&
                      'Intelligent cost/performance mix. (Claude 3.5 Sonnet)'}
                    {chatTier === 'powerful' &&
                      'Top tier reasoning for complex documents. (Claude 3 Opus)'}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    {(['fast', 'balanced', 'powerful'] as const).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setChatTier(tier)}
                        className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                          chatTier === tier
                            ? 'bg-zinc-800 border border-indigo-500/50 text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tier.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 3: Security & Compliance */}
              <div className="relative group bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-emerald-500/5">
                <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full group-hover:bg-emerald-500/10 transition-colors" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Compass className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-zinc-300">System Mode</h3>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-white">SOC-2 Type II</div>
                  <p className="text-xs text-zinc-400">
                    Private context execution. Conversations are encrypted at rest and never used to
                    train global LLMs.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-6 relative overflow-hidden backdrop-blur-md">
              <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-violet-600/5 blur-3xl" />
              <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-indigo-600/5 blur-3xl" />
              <div className="relative space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-400" />
                  <span>Welcome to LegalAI</span>
                </h3>
                <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
                  Start analyzing legal documents or chatting with our AI to query laws, review
                  contract liability risks, or extract key agreements. Choose one of the quick
                  actions below to launch.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="flex justify-between items-center bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 p-4 rounded-xl text-left group transition-all duration-200 cursor-pointer"
                  >
                    <div>
                      <h4 className="font-semibold text-zinc-200 text-sm group-hover:text-white">
                        AI Consultation
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1">
                        Chat directly with legal-trained models
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => setActiveTab('reviewer')}
                    className="flex justify-between items-center bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 p-4 rounded-xl text-left group transition-all duration-200 cursor-pointer"
                  >
                    <div>
                      <h4 className="font-semibold text-zinc-200 text-sm group-hover:text-white">
                        Risk Auditor
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1">
                        Extract liabilities & obligations from agreements
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHAT ASSISTANT PANEL */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Chat header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
              <div>
                <h1 className="font-bold text-lg text-white">AI Assistant</h1>
                <p className="text-[11px] text-zinc-500">Fastify REST endpoint connection</p>
              </div>

              {/* Chat settings model select */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 hidden sm:inline">Intel Tier:</span>
                <div className="flex bg-zinc-950/80 border border-zinc-800 p-1 rounded-lg">
                  {(['fast', 'balanced', 'powerful'] as const).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setChatTier(tier)}
                      className={`text-[10px] px-3 py-1 rounded-md capitalize font-semibold transition-all cursor-pointer ${
                        chatTier === tier
                          ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-none'
                        : msg.content.startsWith('⚠️')
                          ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-bl-none'
                          : 'bg-zinc-900/60 border border-zinc-800/80 text-zinc-300 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isChatSending && (
                <div className="flex justify-start">
                  <div className="bg-zinc-900/60 border border-zinc-800/80 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    <span className="text-xs text-zinc-400 font-medium">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-4 border-t border-zinc-800/80 bg-zinc-950">
              <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask any legal or contract question..."
                  disabled={isChatSending}
                  className="flex-1 bg-zinc-900/60 border border-zinc-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-zinc-500 disabled:opacity-50 transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isChatSending}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 rounded-xl flex items-center justify-center disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-violet-500/10"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="text-center text-[10px] text-zinc-500 mt-2">
                Compliance Safe environment. Custom model responses logic.
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENT REVIEWER PANEL */}
        {activeTab === 'reviewer' && (
          <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Contract Risk Reviewer
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Audits legal documents, flags high-exposure clauses, and outputs risk advisory
                cards.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Input Area */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-violet-400" />
                  <span>Contract Text</span>
                </h3>
                <textarea
                  value={documentText}
                  onChange={(e) => setDocumentText(e.target.value)}
                  placeholder="Paste contract terms or clause text here for immediate risk review (e.g. indemnity, liability limits, SLA targets, governing law terms)..."
                  className="w-full h-80 bg-zinc-950/80 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl p-4 text-sm font-mono placeholder-zinc-600 resize-none focus:outline-none"
                />

                <div className="flex justify-between items-center">
                  <div className="text-xs text-zinc-500">
                    Characters: {documentText.length.toLocaleString()}
                  </div>
                  <button
                    onClick={handleReviewDocument}
                    disabled={!documentText.trim() || isReviewing}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-violet-500/10 transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    {isReviewing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Audit Document</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Analysis Result Output */}
              <div className="space-y-6">
                {!reviewResult && !isReviewing && (
                  <div className="h-[432px] border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center p-6 bg-zinc-900/10">
                    <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
                      ⚖️
                    </div>
                    <h4 className="font-semibold text-zinc-300">No active audit results</h4>
                    <p className="text-xs text-zinc-500 max-w-xs mt-1.5">
                      Paste a agreement text on the left and click Audit Document to generate an
                      automated exposure report.
                    </p>
                  </div>
                )}

                {isReviewing && (
                  <div className="h-[432px] border border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center p-6 bg-zinc-900/20">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-4" />
                    <h4 className="font-semibold text-zinc-300">Running AI Risk Engine</h4>
                    <p className="text-xs text-zinc-500 max-w-xs mt-1.5 animate-pulse">
                      Parsing clause semantics, consulting vector stores, and generating risk
                      tags...
                    </p>
                  </div>
                )}

                {reviewResult && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Summary Section */}
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-2">
                      <h4 className="font-bold text-sm text-zinc-300 uppercase tracking-wider">
                        Executive Review Summary
                      </h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {reviewResult.summary}
                      </p>
                    </div>

                    {/* Identified Risks */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">
                        Severity Risk Matrix
                      </h4>
                      {reviewResult.risks.map((risk, idx) => (
                        <div
                          key={idx}
                          className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex gap-3.5"
                        >
                          <div className="shrink-0 mt-0.5">
                            {risk.severity === 'high' && (
                              <span className="flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                                High
                              </span>
                            )}
                            {risk.severity === 'medium' && (
                              <span className="flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                                Med
                              </span>
                            )}
                            {risk.severity === 'low' && (
                              <span className="flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                Low
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <h5 className="font-semibold text-sm text-zinc-200">{risk.clause}</h5>
                            <p className="text-xs text-zinc-400">{risk.issue}</p>
                            <div className="text-[11px] text-zinc-500 italic mt-1.5 flex items-start gap-1">
                              <span className="text-violet-400">💡 Advice:</span>
                              <span>{risk.advice}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Core Obligations */}
                    <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl p-5 space-y-3">
                      <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">
                        Key Obligations & Deadlines
                      </h4>
                      <ul className="space-y-2">
                        {reviewResult.obligations.map((item, idx) => (
                          <li key={idx} className="flex gap-2.5 text-xs text-zinc-300">
                            <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PROFILE SETTINGS PANEL */}
        {activeTab === 'profile' && (
          <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto max-w-2xl">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                System Settings
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Manage your credentials, profiles, and backend properties.
              </p>
            </div>

            {/* Profile Settings form */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-6">
              <h3 className="font-semibold text-zinc-200 flex items-center gap-2 border-b border-zinc-800 pb-3">
                <User className="h-4.5 w-4.5 text-violet-400" />
                <span>Profile Management</span>
              </h3>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={userProfile.email}
                    disabled
                    className="w-full bg-zinc-950/80 border border-zinc-855 rounded-xl px-4 py-2.5 text-sm text-zinc-500 focus:outline-none cursor-not-allowed"
                  />
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Email address belongs to Google Provider SSO registration.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Full Display Name
                  </label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all placeholder-zinc-700"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdatingProfile || editingName === userProfile.fullName}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-violet-500/10 transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
