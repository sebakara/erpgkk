'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, CheckCircle, Pencil, Eye } from 'lucide-react';
import { docsApi } from '@/lib/api';
import { RichTextEditor } from '@/components/docs/rich-text-editor';
import { formatDate } from '@/lib/utils';
import type { Doc } from '@/types';
import toast from 'react-hot-toast';

export default function DocEditorPage() {
  const { id: projectId, docId } = useParams<{ id: string; docId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: doc, isLoading } = useQuery<Doc>({
    queryKey: ['doc', docId],
    queryFn: () => docsApi.get(projectId, docId),
  });

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setContent(doc.content || '');
    const empty = !doc.content || doc.content === '<p></p>';
    if (empty) setMode('edit');
  }, [doc?.id]);

  const saveMutation = useMutation({
    mutationFn: () => docsApi.update(projectId, docId, { title: title.trim(), content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs', projectId] });
      qc.invalidateQueries({ queryKey: ['doc', docId] });
      setIsDirty(false);
      setLastSaved(new Date());
    },
    onError: () => toast.error('Failed to save'),
  });

  const scheduleAutoSave = useCallback(() => {
    setIsDirty(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveMutation.mutate();
    }, 2000);
  }, [saveMutation]);

  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    scheduleAutoSave();
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    scheduleAutoSave();
  };

  const handleManualSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!doc) return <p className="text-gray-500">Document not found.</p>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push(`/projects/${projectId}/docs`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
          Docs
        </button>

        <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
          {mode === 'edit' && (
            <>
              {saveMutation.isPending && <span>Saving…</span>}
              {!saveMutation.isPending && lastSaved && (
                <span className="flex items-center gap-1">
                  <CheckCircle size={12} className="text-green-500" />
                  Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {isDirty && !saveMutation.isPending && <span className="text-amber-500">Unsaved</span>}
              <button
                onClick={handleManualSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Save size={12} />
                Save
              </button>
            </>
          )}
          <span className="text-gray-300">v{doc.version}</span>
          {/* View / Edit toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setMode('view')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${mode === 'view' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Eye size={12} /> View
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${mode === 'edit' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Doc meta */}
      <div className="text-xs text-gray-400 flex items-center gap-3">
        {doc.author_name && <span>By {doc.author_name}</span>}
        <span>Last updated {formatDate(doc.updated_at)}</span>
      </div>

      {/* Title */}
      {mode === 'view' ? (
        <h1 className="text-3xl font-bold text-gray-900">{title || 'Untitled'}</h1>
      ) : (
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="Document title…"
          className="w-full text-3xl font-bold text-gray-900 focus:outline-none placeholder:text-gray-300 bg-transparent"
        />
      )}

      {/* Editor / Viewer — click the body in view mode to start typing */}
      <div
        onClick={() => {
          if (mode === 'view') setMode('edit');
        }}
        className={mode === 'view' ? 'cursor-text' : undefined}
      >
        <RichTextEditor content={content} onChange={handleContentChange} editable={mode === 'edit'} />
      </div>
    </div>
  );
}
