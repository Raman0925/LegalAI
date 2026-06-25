'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { api, type MatterRecord } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Briefcase, Plus, Search, Calendar, User, FolderOpen, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MattersClientProps {
  initialUser: {
    id: string;
    email: string;
    user_metadata: Record<string, any>;
  };
}

const TYPE_LABELS: Record<MatterRecord['matterType'], string> = {
  general: 'General Advisory',
  contract: 'Contract Review',
  litigation: 'Litigation Dispute',
  advisory: 'Legal Advisory',
  compliance: 'Regulatory Compliance',
};

const STATUS_CONFIG: Record<MatterRecord['status'], { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  in_progress: { label: 'In Progress', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  closed: { label: 'Closed', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  archived: { label: 'Archived', className: 'bg-zinc-800 text-zinc-500 border-zinc-700/30' },
};

export function MattersClient({ initialUser }: MattersClientProps) {
  const userProfile = {
    fullName: initialUser.user_metadata?.full_name || '',
    email: initialUser.email,
  };

  const [matters, setMatters] = React.useState<MatterRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [newTitle, setNewTitle] = React.useState('');
  const [newClientName, setNewClientName] = React.useState('');
  const [newMatterType, setNewMatterType] = React.useState<MatterRecord['matterType']>('general');
  const [newDescription, setNewDescription] = React.useState('');

  const loadMatters = React.useCallback(async () => {
    try {
      const list = await api.matters.list();
      setMatters(list);
    } catch (err: any) {
      toast({
        title: 'Failed to load matters',
        description: err.message || 'Could not fetch legal matters.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadMatters();
  }, [loadMatters]);

  async function handleCreateMatter(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast({ title: 'Validation Error', description: 'Title is required.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.matters.create({
        title: newTitle,
        clientName: newClientName.trim() || null,
        matterType: newMatterType,
        description: newDescription.trim() || null,
        status: 'open',
      });

      toast({ title: 'Matter created', description: `"${newTitle}" has been opened.` });
      
      // Reset form and reload list
      setNewTitle('');
      setNewClientName('');
      setNewMatterType('general');
      setNewDescription('');
      setShowCreateModal(false);
      loadMatters();
    } catch (err: any) {
      toast({
        title: 'Failed to create matter',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredMatters = matters.filter((m) => {
    const titleMatch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
    const clientMatch = m.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    const typeMatch = TYPE_LABELS[m.matterType].toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || clientMatch || typeMatch;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row antialiased">
      <Sidebar active="matters" userProfile={userProfile} />

      <main className="flex-1 flex flex-col min-h-0 bg-zinc-950">
        <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Matters
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Manage legal matters, run RAG clause extraction, and generate binding legal drafts.
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/10 cursor-pointer self-start sm:self-auto shrink-0 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Matter</span>
            </Button>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by title, client, or type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>

          {/* Matters Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading legal matters…</span>
            </div>
          ) : filteredMatters.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center bg-zinc-900/10 max-w-xl mx-auto space-y-4">
              <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
                <Briefcase className="h-5 w-5" />
              </div>
              <p className="text-sm text-zinc-400">No matters found. Create a new matter to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMatters.map((matter) => {
                const badge = STATUS_CONFIG[matter.status];
                return (
                  <Link
                    key={matter.id}
                    href={`/dashboard/matters/${matter.id}`}
                    className="group border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-5 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all duration-300 flex flex-col justify-between space-y-4 shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[10px] uppercase font-semibold text-violet-400 font-mono tracking-wider">
                          {TYPE_LABELS[matter.matterType]}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-zinc-200 group-hover:text-white transition-colors line-clamp-1">
                        {matter.title}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2 min-h-[2rem]">
                        {matter.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[100px]">{matter.clientName || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span>{matter.documentCount ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(matter.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* New Matter Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <form
            onSubmit={handleCreateMatter}
            className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <h3 className="font-bold text-white text-lg">Create New Matter</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Matter Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp Series A Financing"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Client Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Matter Type</label>
                <select
                  value={newMatterType}
                  onChange={(e) => setNewMatterType(e.target.value as MatterRecord['matterType'])}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
                >
                  <option value="general">General Advisory</option>
                  <option value="contract">Contract Review</option>
                  <option value="litigation">Litigation Dispute</option>
                  <option value="advisory">Legal Advisory</option>
                  <option value="compliance">Regulatory Compliance</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Description</label>
                <textarea
                  placeholder="Brief details about the matter…"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-violet-600 hover:bg-violet-700 text-white cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Matter
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
