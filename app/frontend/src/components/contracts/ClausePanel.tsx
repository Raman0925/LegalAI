'use client';

import { useState, useRef, useEffect } from 'react';
import { ContractAnnotation } from '@/types/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuthHeaders } from '@/lib/api';

interface ClausePanelProps {
  contractId: string;
  selectedAnnotation: ContractAnnotation | null;
  activePage: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ClausePanel({ contractId, selectedAnnotation, activePage }: ClausePanelProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamedText, setStreamedText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clear messages when selection changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMessages([]);
    setStreamedText('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedAnnotation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedText]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userMsg = question;
    setQuestion('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setStreamedText('');

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/proxy?path=/contracts/${contractId}/ask`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          question: userMsg,
          annotationId: selectedAnnotation?.id || undefined,
          pageNumber: selectedAnnotation?.pageNumber || activePage || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');

      let done = false;
      let partialLine = '';
      let currentText = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          const lines = (partialLine + chunk).split('\n\n');
          partialLine = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'text') {
                  currentText += parsed.text;
                  setStreamedText(currentText);
                } else if (parsed.type === 'done') {
                  // completed stream
                } else if (parsed.type === 'error') {
                  currentText += `\n[Error: ${parsed.error}]`;
                  setStreamedText(currentText);
                }
              } catch {
                // ignore parsing error
              }
            }
          }
        }
      }

      // Append final assistant message
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: currentText || 'No response.' },
      ]);
      setStreamedText('');
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'An error occurred while answering your question.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Clause-level Follow-up Q&A</h3>
          <p className="text-[10px] text-gray-500">Ask the AI questions about specific terms</p>
        </div>
        {selectedAnnotation ? (
          <Badge variant="outline" className="text-[10px] capitalize max-w-44 truncate">
            {selectedAnnotation.clauseType.replace(/_/g, ' ')} (Page {selectedAnnotation.pageNumber})
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            Page {activePage} Context
          </Badge>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-36">
        {messages.length === 0 && !streamedText && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 py-6">
            <span className="text-xl mb-1 block">💬</span>
            <p className="text-xs font-medium">Have questions about this contract?</p>
            {selectedAnnotation ? (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Type your question below to analyze the highlighted **{selectedAnnotation.clauseType.replace(/_/g, ' ')}** clause.
              </p>
            ) : (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Select an annotation on the sidebar or enter a question to analyze Page {activePage}.
              </p>
            )}
          </div>
        )}

        {/* Message History */}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col max-w-[85%] rounded-lg p-2.5 text-xs ${
              m.role === 'user'
                ? 'bg-blue-600 text-white ml-auto rounded-tr-none'
                : 'bg-gray-100 text-gray-800 mr-auto rounded-tl-none border border-gray-200'
            }`}
          >
            <span className="text-[9px] font-semibold opacity-70 mb-0.5 uppercase tracking-wide">
              {m.role === 'user' ? 'You' : 'AI Legal Assistant'}
            </span>
            <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}

        {/* Streaming text bubble */}
        {streamedText && (
          <div className="flex flex-col max-w-[85%] rounded-lg p-2.5 text-xs bg-gray-100 text-gray-800 mr-auto rounded-tl-none border border-gray-200 animate-fadeIn">
            <span className="text-[9px] font-semibold opacity-70 mb-0.5 uppercase tracking-wide">
              AI Legal Assistant (Typing...)
            </span>
            <p className="leading-relaxed whitespace-pre-wrap">{streamedText}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleAsk} className="p-3 border-t bg-gray-50 flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
          placeholder={
            selectedAnnotation
              ? `Ask about this ${selectedAnnotation.clauseType.replace(/_/g, ' ')}...`
              : "Ask about this page..."
          }
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
        />
        <Button type="submit" disabled={loading || !question.trim()} size="sm" className="px-3 h-8 text-xs font-semibold">
          {loading ? 'Asking...' : 'Ask'}
        </Button>
      </form>
    </div>
  );
}
