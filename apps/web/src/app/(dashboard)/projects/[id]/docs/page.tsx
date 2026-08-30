'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Clock, User, Trash2 } from 'lucide-react';
import { docsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Doc } from '@/types';
import toast from 'react-hot-toast';

export default function DocsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: docs = [], isLoading } = useQuery<Doc[]>({
    queryKey: ['docs', projectId],
    queryFn: () => docsApi.list(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () => docsApi.create(projectId, { title: newTitle.trim(), content: '' }),
    onSuccess: (doc: Doc) => {
      qc.invalidateQueries({ queryKey: ['docs', projectId] });
      toast.success('Document created');
      setShowCreate(false);
      setNewTitle('');
      router.push(`/projects/${projectId}/docs/${doc.id}`);
    },
    onError: () => toast.error('Failed to create document'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => docsApi.remove(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs', projectId] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Failed to delete document'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Documentation</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={15} />
          New Document
        </button>
      </div>

      {/* Create new doc inline */}
      {showCreate && (
        <div className="bg-white rounded-xl border-2 border-primary-200 p-4 flex items-center gap-3">
          <FileText size={18} className="text-primary-500 shrink-0" />
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle.trim()) createMutation.mutate();
              if (e.key === 'Escape') { setShowCreate(false); setNewTitle(''); }
            }}
            placeholder="Document title…"
            className="flex-1 text-sm font-medium focus:outline-none placeholder:text-gray-400"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setShowCreate(false); setNewTitle(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={() => newTitle.trim() && createMutation.mutate()}
              disabled={!newTitle.trim() || createMutation.isPending}
              className="text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Doc list */}
      {docs.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-14 text-center">
          <FileText size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">No documents yet</p>
          <p className="text-sm text-gray-400 mb-4">Create your first document to start building a knowledge base.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            + New Document
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl border border-gray-200 flex items-center hover:border-primary-200 hover:shadow-sm transition-all group"
            >
              <Link
                href={`/projects/${projectId}/docs/${doc.id}`}
                className="min-w-0 flex flex-1 items-center gap-4 px-5 py-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label={`Open ${doc.title}`}
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{doc.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {doc.author_name && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <User size={11} />
                        {doc.author_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />
                      {formatDate(doc.updated_at)}
                    </span>
                    <span className="text-xs text-gray-300">v{doc.version}</span>
                  </div>
                </div>
              </Link>
              <button
                onClick={() => {
                  if (confirm('Delete this document?')) deleteMutation.mutate(doc.id);
                }}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-2 mr-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                aria-label={`Delete ${doc.title}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
