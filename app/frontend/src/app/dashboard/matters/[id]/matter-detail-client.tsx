'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  api,
  type MatterWithDetails,
  type DocumentRecord,
  type MatterClause,
  type MatterDraft,
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  Briefcase,
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Download,
  AlertTriangle,
  Copy,
  Check,
  FileImage,
  ExternalLink,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MatterDetailClientProps {
  id: string;
  initialUser: {
    id: string;
    email: string;
    user_metadata: Record<string, any>;
  };
}

type TabType = 'documents' | 'clauses' | 'drafts' | 'export';

const RISK_BADGES: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export function MatterDetailClient({ id, initialUser }: MatterDetailClientProps) {
  const userProfile = {
    fullName: initialUser.user_metadata?.full_name || '',
    email: initialUser.email,
  };

  const [activeTab, setActiveTab] = React.useState<TabType>('documents');
  const [details, setDetails] = React.useState<MatterWithDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Ready documents for attachment modal
  const [readyDocs, setReadyDocs] = React.useState<DocumentRecord[]>([]);
  const [showAttachModal, setShowAttachModal] = React.useState(false);
  const [isAttaching, setIsAttaching] = React.useState(false);

  // Extraction State
  const [isExtracting, setIsExtracting] = React.useState(false);

  // Draft Creation State
  const [draftTitle, setDraftTitle] = React.useState('');
  const [draftType, setDraftType] = React.useState<'contract' | 'letter' | 'memo' | 'clause'>(
    'contract',
  );
  const [draftInstructions, setDraftInstructions] = React.useState('');
  const [isDrafting, setIsDrafting] = React.useState(false);
  const [selectedDraft, setSelectedDraft] = React.useState<MatterDraft | null>(null);
  const [copiedDraftId, setCopiedDraftId] = React.useState<string | null>(null);
  const [isDeletingDraft, setIsDeletingDraft] = React.useState<string | null>(null);

  // Export State
  const [isExporting, setIsExporting] = React.useState<'pdf' | 'docx' | null>(null);

  const hasAutoSelectedDraft = React.useRef(false);

  const loadDetails = React.useCallback(async () => {
    try {
      const data = await api.matters.getById(id);
      setDetails(data);
      // Auto-select the first draft only once on initial load
      if (data.drafts.length > 0 && !hasAutoSelectedDraft.current) {
        hasAutoSelectedDraft.current = true;
        setSelectedDraft(data.drafts[0]);
      }
    } catch (err: any) {
      toast({
        title: 'Failed to load details',
        description: err.message || 'Could not fetch matter details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [id]); // id is the only real dependency — selectedDraft was causing an infinite loop

  React.useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Load user's ready documents for attachment dropdown
  const loadReadyDocuments = React.useCallback(async () => {
    try {
      const docs = await api.documents.list();
      setReadyDocs(docs.filter((d) => d.status === 'ready'));
    } catch (err: any) {
      console.error('Failed to load library documents:', err);
    }
  }, []);

  React.useEffect(() => {
    if (showAttachModal) {
      loadReadyDocuments();
    }
  }, [showAttachModal, loadReadyDocuments]);

  async function handleAttachDocument(docId: string) {
    setIsAttaching(true);
    try {
      await api.matters.attachDocument(id, docId);
      toast({ title: 'Document attached' });
      setShowAttachModal(false);
      loadDetails();
    } catch (err: any) {
      toast({
        title: 'Failed to attach',
        description: err.message || 'Error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsAttaching(false);
    }
  }

  async function handleDetachDocument(docId: string) {
    try {
      await api.matters.detachDocument(id, docId);
      toast({ title: 'Document detached' });
      loadDetails();
    } catch (err: any) {
      toast({
        title: 'Failed to detach',
        description: err.message || 'Error occurred.',
        variant: 'destructive',
      });
    }
  }

  async function handleExtractClauses() {
    setIsExtracting(true);
    try {
      const clauses = await api.matters.extractClauses(id);
      toast({
        title: 'Extraction completed',
        description: `Successfully extracted ${clauses.length} clauses from attached documents.`,
      });
      loadDetails();
    } catch (err: any) {
      toast({
        title: 'Extraction failed',
        description: err.message || 'Error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draftTitle.trim() || !draftInstructions.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title and instructions are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsDrafting(true);
    try {
      const draft = await api.matters.createDraft(id, {
        title: draftTitle,
        draftType,
        instructions: draftInstructions,
      });
      toast({ title: 'Draft generated successfully' });
      setDraftTitle('');
      setDraftInstructions('');
      setSelectedDraft(draft);
      loadDetails();
    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err.message || 'Error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleDeleteDraft(draftId: string) {
    setIsDeletingDraft(draftId);
    try {
      await api.matters.deleteDraft(id, draftId);
      toast({ title: 'Draft deleted' });
      if (selectedDraft?.id === draftId) {
        setSelectedDraft(null);
      }
      loadDetails();
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err.message || 'Could not delete draft.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingDraft(null);
    }
  }

  async function handleExport(format: 'pdf' | 'docx') {
    if (!details) return;
    setIsExporting(format);
    try {
      if (format === 'pdf') {
        await api.matters.exportPdf(id, details.title);
      } else {
        await api.matters.exportDocx(id, details.title);
      }
      toast({ title: 'Export downloaded' });
    } catch (err: any) {
      toast({
        title: 'Export failed',
        description: err.message || 'Could not export matter.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(null);
    }
  }

  function handleCopyDraftContent(content: string, draftId: string) {
    navigator.clipboard.writeText(content);
    setCopiedDraftId(draftId);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopiedDraftId(null), 2000);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
        <Sidebar active="matters" userProfile={userProfile} />
        <main className="flex-1 flex items-center justify-center gap-2 bg-zinc-950">
          <Loader2 className="h-6 w-6 text-violet-400 animate-spin" />
          <span className="text-zinc-400">Loading matter details…</span>
        </main>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
        <Sidebar active="matters" userProfile={userProfile} />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6">
          <AlertTriangle className="h-10 w-10 text-rose-500" />
          <p className="text-zinc-400">Matter not found or access denied.</p>
          <Link href="/dashboard/matters">
            <Button variant="outline" className="border-zinc-800 hover:bg-zinc-900 cursor-pointer">
              Back to Matters List
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  // Filter unattached documents
  const unattachedDocs = readyDocs.filter(
    (rd) => !details.attachedDocuments.some((ad) => ad.id === rd.id),
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
      <Sidebar active="matters" userProfile={userProfile} />

      <main className="flex-1 flex flex-col min-h-0 bg-zinc-950">
        <div className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Breadcrumb / Back button */}
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/matters"
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to Matters</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-zinc-700" />
            <span className="text-xs text-zinc-400 font-mono truncate">{details.title}</span>
          </div>

          {/* Heading */}
          <div className="space-y-2 border-b border-zinc-900 pb-5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                {details.title}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase tracking-wide">
                {details.matterType}
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              Client:{' '}
              <span className="text-zinc-200 font-medium">{details.clientName || 'N/A'}</span>
              <span className="mx-2 text-zinc-700">|</span>
              Status: <span className="text-zinc-200 font-medium capitalize">{details.status}</span>
            </p>
            {details.description && (
              <p className="text-xs text-zinc-500 max-w-2xl">{details.description}</p>
            )}
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-zinc-800 gap-6 text-sm">
            {(['documents', 'clauses', 'drafts', 'export'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2.5 font-medium transition-colors border-b-2 capitalize cursor-pointer -mb-px ${
                  activeTab === tab
                    ? 'border-violet-500 text-white font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Panels */}
          <div className="pt-2">
            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-white">Attached Documents</h3>
                    <p className="text-xs text-zinc-500">
                      Attach contracts and references to include in RAG actions.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowAttachModal(true)}
                    className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Attach Document</span>
                  </Button>
                </div>

                {details.attachedDocuments.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center bg-zinc-900/10">
                    <p className="text-sm text-zinc-500">No documents attached yet.</p>
                  </div>
                ) : (
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase font-semibold">
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.attachedDocuments.map((doc) => {
                          const isImg = doc.fileType === 'image';
                          return (
                            <tr
                              key={doc.id}
                              className="border-b border-zinc-800/60 last:border-b-0"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 max-w-md">
                                  {isImg ? (
                                    <FileImage className="h-4 w-4 text-violet-400 shrink-0" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-violet-400 shrink-0" />
                                  )}
                                  <span className="text-zinc-200 font-medium truncate">
                                    {doc.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 uppercase text-xs font-mono text-zinc-400">
                                {doc.fileType}
                              </td>
                              <td className="px-4 py-3 capitalize text-zinc-400">{doc.status}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleDetachDocument(doc.id)}
                                  className="text-zinc-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Detach document"
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
                )}
              </div>
            )}

            {/* Clauses Tab */}
            {activeTab === 'clauses' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-white">Extracted Key Clauses</h3>
                    <p className="text-xs text-zinc-500">
                      Run structured analysis to find liabilities and key conditions.
                    </p>
                  </div>
                  <Button
                    onClick={handleExtractClauses}
                    disabled={isExtracting || details.attachedDocuments.length === 0}
                    className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer flex items-center gap-1.5 shadow-lg shadow-violet-500/10"
                  >
                    {isExtracting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Briefcase className="h-4 w-4" />
                    )}
                    <span>{isExtracting ? 'Analyzing Documents…' : 'Extract Clauses'}</span>
                  </Button>
                </div>

                {details.attachedDocuments.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center bg-rose-500/5 border-rose-500/10">
                    <p className="text-sm text-rose-400/90 font-medium">
                      Please attach at least one document to run clause extraction.
                    </p>
                  </div>
                ) : details.clauses.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center bg-zinc-900/10">
                    <p className="text-sm text-zinc-500">
                      No clauses extracted. Click &quot;Extract Clauses&quot; to analyze.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {details.clauses.map((clause) => {
                      const badgeClass = RISK_BADGES[clause.riskLevel || 'low'];
                      const matchingDoc = details.attachedDocuments.find(
                        (d) => d.id === clause.documentId,
                      );
                      return (
                        <div
                          key={clause.id}
                          className="border border-zinc-800/80 rounded-xl p-5 bg-zinc-900/20 space-y-3 shadow-sm hover:border-zinc-700/80 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs uppercase font-mono tracking-wider font-semibold text-violet-400">
                              {clause.clauseType.replace(/_/g, ' ')}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${badgeClass}`}
                            >
                              {clause.riskLevel || 'low'} Risk
                            </span>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed font-serif bg-zinc-950/40 p-3 rounded-lg border border-zinc-900/80">
                            {clause.content}
                          </p>
                          {matchingDoc && (
                            <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5" />
                              <span>Source Document: {matchingDoc.name}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Drafts Tab */}
            {activeTab === 'drafts' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Form column */}
                <div className="lg:col-span-4 space-y-6">
                  <div>
                    <h3 className="font-bold text-lg text-white font-sans">Generate Legal Draft</h3>
                    <p className="text-xs text-zinc-500">
                      Use clauses and documents context to write legal content.
                    </p>
                  </div>

                  <form
                    onSubmit={handleCreateDraft}
                    className="space-y-4 border border-zinc-800/80 p-5 rounded-xl bg-zinc-900/10"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Draft Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Indemnification Rider"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Draft Type</label>
                      <select
                        value={draftType}
                        onChange={(e) => setDraftType(e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
                      >
                        <option value="contract">Full Contract</option>
                        <option value="letter">Formal Letter</option>
                        <option value="memo">Legal Memo</option>
                        <option value="clause">Specific Clause</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400">
                        Generation Instructions
                      </label>
                      <textarea
                        required
                        placeholder="Detail the covenants, obligations, or context to emphasize in the draft…"
                        value={draftInstructions}
                        onChange={(e) => setDraftInstructions(e.target.value)}
                        rows={4}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isDrafting}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                    >
                      {isDrafting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      <span>{isDrafting ? 'Drafting with Sonnet…' : 'Generate Draft'}</span>
                    </Button>
                  </form>

                  {/* Historical Drafts List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Previous Drafts
                    </h4>
                    {details.drafts.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">No drafts generated yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {details.drafts.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => setSelectedDraft(d)}
                            className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between group ${
                              selectedDraft?.id === d.id
                                ? 'bg-zinc-800/60 border-zinc-700 text-white shadow-inner'
                                : 'bg-zinc-900/10 border-zinc-800/80 hover:border-zinc-700 text-zinc-300'
                            }`}
                          >
                            <div className="overflow-hidden">
                              <p className="text-xs font-semibold truncate">{d.title}</p>
                              <span className="text-[9px] uppercase font-mono text-zinc-500">
                                {d.draftType}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDraft(d.id);
                              }}
                              disabled={isDeletingDraft === d.id}
                              className="text-zinc-500 hover:text-rose-400 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer shrink-0"
                              title="Delete draft"
                            >
                              {isDeletingDraft === d.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview column */}
                <div className="lg:col-span-8 space-y-4">
                  {selectedDraft ? (
                    <div className="border border-zinc-800 rounded-xl bg-zinc-900/20 overflow-hidden flex flex-col h-[520px] shadow-sm">
                      {/* Preview header */}
                      <div className="bg-zinc-900/50 px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-zinc-200 text-sm line-clamp-1">
                            {selectedDraft.title}
                          </h4>
                          <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wide">
                            Previewing generated {selectedDraft.draftType}
                          </span>
                        </div>
                        <Button
                          onClick={() =>
                            handleCopyDraftContent(selectedDraft.content, selectedDraft.id)
                          }
                          variant="ghost"
                          className="text-zinc-400 hover:text-white cursor-pointer shrink-0 flex items-center gap-1.5 hover:bg-zinc-800/50"
                        >
                          {copiedDraftId === selectedDraft.id ? (
                            <>
                              <Check className="h-4 w-4 text-emerald-400 animate-pulse" />
                              <span className="text-xs text-emerald-400 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              <span className="text-xs">Copy Text</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Content panel */}
                      <div className="p-6 flex-1 overflow-y-auto font-serif text-sm text-zinc-300 leading-relaxed bg-zinc-950/20 selection:bg-violet-500/20 whitespace-pre-wrap">
                        {selectedDraft.content}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-zinc-800 rounded-xl h-[520px] flex items-center justify-center text-zinc-500 bg-zinc-900/5">
                      <p className="text-sm">
                        No draft selected. Generate or pick one from the list.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h3 className="font-bold text-lg text-white">Export Legal Matter Documents</h3>
                  <p className="text-xs text-zinc-500">
                    Download a compiled summary of matter details, extracted clauses, and drafts.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* PDF card */}
                  <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/20 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors shadow-sm">
                    <div className="space-y-1">
                      <h4 className="font-bold text-zinc-200 text-sm">Download PDF Format</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Compiles summary report, attached file references, risks, and drafts into a
                        secure PDF.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleExport('pdf')}
                      disabled={isExporting !== null}
                      className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/10"
                    >
                      {isExporting === 'pdf' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      <span>{isExporting === 'pdf' ? 'Compiling PDF…' : 'Export PDF'}</span>
                    </Button>
                  </div>

                  {/* DOCX card */}
                  <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/20 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors shadow-sm">
                    <div className="space-y-1">
                      <h4 className="font-bold text-zinc-200 text-sm">Download Word Document</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Compiles matter summary and drafts into a fully editable DOCX document
                        matching legal standards.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleExport('docx')}
                      disabled={isExporting !== null}
                      className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isExporting === 'docx' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      <span>{isExporting === 'docx' ? 'Compiling Word…' : 'Export DOCX'}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Attach Document Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAttachModal(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <h3 className="font-bold text-white text-lg">Attach Document</h3>
              <button
                type="button"
                onClick={() => setShowAttachModal(false)}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {unattachedDocs.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-sm text-zinc-400">
                  No ready documents in the library to attach.
                </p>
                <p className="text-xs text-zinc-600">
                  Please upload and process files in Document Library first.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {unattachedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-zinc-950/40 border border-zinc-800 rounded-lg flex items-center justify-between hover:border-zinc-700/80 transition-all group"
                  >
                    <div className="overflow-hidden mr-3">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{doc.name}</p>
                      <span className="text-[9px] uppercase font-mono text-zinc-500">
                        {doc.fileType}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAttachDocument(doc.id)}
                      disabled={isAttaching}
                      className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer h-7 text-[10px]"
                    >
                      Attach
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-zinc-800/60">
              <Button
                variant="ghost"
                onClick={() => setShowAttachModal(false)}
                className="cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
