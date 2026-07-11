'use client';

import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { Contract, ContractAnnotation } from '@/types/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, ChevronRight, CornerDownLeft, X, Loader2 } from 'lucide-react';

interface ClauseLibraryProps {
  editor: Editor | null;
  onClose?: () => void;
}

import { getAuthHeaders } from '@/lib/api';

export function ClauseLibrary({ editor, onClose }: ClauseLibraryProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [annotations, setAnnotations] = useState<ContractAnnotation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setLoadingContracts(true);
        const authHeaders = await getAuthHeaders();
        const res = await fetch('/api/proxy?path=/contracts', {
          headers: authHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          setContracts(data.contracts || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingContracts(false);
      }
    };
    fetchContracts();
  }, []);

  const handleSelectContract = async (contract: Contract) => {
    setSelectedContract(contract);
    setSearchTerm('');
    setFilterType('all');
    try {
      setLoadingAnnotations(true);
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/proxy?path=/contracts/${contract.id}/annotations`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.annotations || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnnotations(false);
    }
  };

  const handleInsert = (text: string) => {
    if (!editor) return;
    editor.commands.insertContent(text);
  };

  // Filter clauses
  const filteredAnnotations = annotations.filter((a) => {
    const matchesSearch =
      a.clauseText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.explanation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.clauseType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || a.clauseType === filterType;
    return matchesSearch && matchesType;
  });

  const clauseTypes = Array.from(new Set(annotations.map((a) => a.clauseType)));

  return (
    <div className="flex flex-col h-full bg-white border-l shadow-xl w-80 shrink-0">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Clause Library</h3>
          <p className="text-[10px] text-gray-500">Insert annotated clauses from Phase 6</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4 text-gray-400" />
          </Button>
        )}
      </div>

      {/* Contract Selector (First View) */}
      {!selectedContract ? (
        <div className="flex-1 overflow-y-auto p-4">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3 block">
            Select a contract source
          </span>
          {loadingContracts ? (
            <div className="flex items-center justify-center p-8 text-gray-400 text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading contracts...
            </div>
          ) : contracts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center p-8">No contracts uploaded yet. Create contract reviews first.</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectContract(c)}
                  className="p-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-semibold text-gray-800 truncate block" title={c.filename}>
                      {c.filename}
                    </span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Clauses Selector (Second View) */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Back to Contracts */}
          <div className="px-4 py-2 border-b bg-gray-50/50 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-7 px-2 font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => setSelectedContract(null)}
            >
              ← Back to Contracts
            </Button>
            <span className="text-[10px] text-gray-400 truncate max-w-40 font-mono" title={selectedContract.filename}>
              {selectedContract.filename}
            </span>
          </div>

          {/* Search and Filters */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search clauses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 bg-white"
              />
            </div>
            {clauseTypes.length > 0 && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Clause Types</option>
                {clauseTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Clauses List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loadingAnnotations ? (
              <div className="flex items-center justify-center p-8 text-gray-400 text-xs gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading clauses...
              </div>
            ) : filteredAnnotations.length === 0 ? (
              <p className="text-xs text-gray-400 text-center p-8">No matching clauses found.</p>
            ) : (
              filteredAnnotations.map((a) => (
                <div
                  key={a.id}
                  className="p-2.5 border rounded-lg border-gray-200 bg-gray-50/50 hover:bg-white hover:shadow-sm transition"
                >
                  {/* Metadata Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wide">
                      Page {a.pageNumber} {a.citationRef && `• ${a.citationRef}`}
                    </span>
                    <Badge variant="secondary" className="text-[9px] py-0 px-1 hover:bg-gray-100 font-bold uppercase">
                      {a.riskLevel}
                    </Badge>
                  </div>

                  {/* Clause Title */}
                  <h4 className="text-xs font-bold text-gray-800 capitalize mb-1">
                    {a.clauseType.replace(/_/g, ' ')}
                  </h4>

                  {/* Snippet */}
                  <p className="text-[10px] text-gray-600 line-clamp-3 bg-white border rounded p-1 mb-2 font-mono italic">
                    &ldquo;{a.clauseText}&rdquo;
                  </p>

                  {/* Actions */}
                  <Button
                    onClick={() => handleInsert(a.clauseText)}
                    size="sm"
                    className="w-full text-[10px] h-7 font-bold bg-blue-600 hover:bg-blue-700 text-white flex gap-1 items-center justify-center"
                  >
                    <CornerDownLeft className="h-3 w-3" /> Insert into Document
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
