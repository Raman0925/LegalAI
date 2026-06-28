'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import { JSONContent } from '@tiptap/react';
import { RewriteTone, REWRITE_TONES } from '@/types/editor';
import { Button } from '@/components/ui/button';

interface TipTapEditorProps {
  documentId: string;
  initialContent: JSONContent;
  title: string;
  onSave: (content: JSONContent, wordCount: number) => void;
  onWordCountChange: (count: number) => void;
  onEditorReady?: (editor: Editor) => void;
}

export function TipTapEditor({
  documentId,
  initialContent,
  title,
  onSave,
  onWordCountChange,
  onEditorReady,
}: TipTapEditorProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveCountRef = useRef(0);
  const suggestionAbortRef = useRef<AbortController | null>(null);
  const rewriteAbortRef = useRef<AbortController | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start drafting your document...' }),
      CharacterCount,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      // Word count
      const words = editor.storage.characterCount.words();
      onWordCountChange(words);

      // Debounced auto-save — reset timer on every keystroke
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveCountRef.current += 1;
        onSave(editor.getJSON(), words);
      }, 30_000); // 30 seconds
    },
  });

  // Expose editor instance to parent
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      suggestionAbortRef.current?.abort();
      rewriteAbortRef.current?.abort();
    };
  }, []);

  const handleSuggest = useCallback(async () => {
    if (!editor) return;
    suggestionAbortRef.current?.abort();
    suggestionAbortRef.current = new AbortController();

    const { from } = editor.state.selection;
    const precedingText = editor.state.doc.textBetween(0, from, ' ');

    const token = localStorage.getItem('token');
    const res = await fetch(`/api/proxy?path=/editor/documents/${documentId}/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ precedingText, documentTitle: title }),
      signal: suggestionAbortRef.current.signal,
    });

    if (!res.ok) return;

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let partialLine = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunk).split('\n\n');
      partialLine = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6).trim());
          if (parsed.type === 'text') {
            // Insert text at cursor as it streams
            editor.commands.insertContent(parsed.text);
          }
        } catch {}
      }
    }
  }, [editor, documentId, title]);

  const handleRewrite = useCallback(async (tone: RewriteTone) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return; // nothing selected

    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    rewriteAbortRef.current?.abort();
    rewriteAbortRef.current = new AbortController();

    const token = localStorage.getItem('token');
    const res = await fetch(`/api/proxy?path=/editor/documents/${documentId}/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ selectedText, tone, documentTitle: title }),
      signal: rewriteAbortRef.current.signal,
    });

    if (!res.ok) return;

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let partialLine = '';

    // Delete selection first
    editor.commands.deleteSelection();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunk).split('\n\n');
      partialLine = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6).trim());
          if (parsed.type === 'text') {
            editor.commands.insertContent(parsed.text);
          }
        } catch {}
      }
    }
  }, [editor, documentId, title]);

  if (!editor) return null;

  return (
    <div className="relative h-full flex flex-col border rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-gray-50 flex-wrap shadow-sm">
        <Button
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0 font-bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >B</Button>
        <Button
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0 italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >I</Button>
        <Button
          variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2 text-xs font-bold"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >H1</Button>
        <Button
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2 text-xs font-bold"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >H2</Button>
        <Button
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >• List</Button>
        <div className="h-4 w-px bg-gray-300 mx-1" />
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs font-bold flex gap-1 items-center border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50"
          onClick={handleSuggest}
          title="AI suggestion based on text before cursor"
        >
          ✨ Suggest
        </Button>
      </div>

      {/* Bubble Menu — appears on text selection */}
      <BubbleMenu editor={editor}>
        <div className="flex gap-1 bg-white shadow-xl border rounded-lg p-1.5 z-50">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 px-1 flex items-center">Rewrite tone:</span>
          {REWRITE_TONES.map(tone => (
            <Button
              key={tone}
              variant="outline"
              size="sm"
              className="text-[10px] h-7 px-2 capitalize bg-gray-50 hover:bg-gray-100"
              onClick={() => handleRewrite(tone)}
            >
              {tone}
            </Button>
          ))}
        </div>
      </BubbleMenu>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto px-10 py-8 bg-white min-h-[300px]">
        <EditorContent
          editor={editor}
          className="outline-none min-h-full font-serif text-gray-800 leading-relaxed max-w-3xl mx-auto prose"
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t bg-gray-50 text-[10px] text-gray-400 flex justify-between">
        <span className="font-medium">{editor.storage.characterCount.words()} words</span>
        <span className="font-medium text-gray-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-ping" /> Auto-saves every 30s
        </span>
      </div>
    </div>
  );
}
