'use client';
import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, Trash2, Download, FileText, FileImage, FileSpreadsheet,
  File, FolderOpen, X, Eye,
} from 'lucide-react';
import { filesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function FileIcon({ mime, size = 24 }: { mime: string; size?: number }) {
  if (mime.startsWith('image/'))       return <FileImage size={size} className="text-purple-500" />;
  if (mime === 'application/pdf')      return <FileText size={size} className="text-red-500" />;
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv'))
                                       return <FileSpreadsheet size={size} className="text-green-600" />;
  if (mime.includes('word') || mime.includes('document'))
                                       return <FileText size={size} className="text-blue-500" />;
  return <File size={size} className="text-gray-400" />;
}

function isPreviewable(mime: string) {
  return mime.startsWith('image/') || mime === 'application/pdf';
}

interface ProjectFile {
  id: string;
  original_name: string;
  url: string;
  size: number;
  mime_type: string;
  created_at: string;
  uploader_name: string;
  uploader_avatar?: string;
}

export default function FolderPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ProjectFile | null>(null);
  const [dragging, setDragging] = useState(false);

  const { data: files = [], isLoading } = useQuery<ProjectFile[]>({
    queryKey: ['project-files', projectId],
    queryFn: () => filesApi.list(projectId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => filesApi.upload(projectId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-files', projectId] });
      toast.success('File uploaded');
    },
    onError: () => toast.error('Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => filesApi.remove(projectId, fileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-files', projectId] });
      toast.success('File deleted');
    },
    onError: () => toast.error('Delete failed'),
  });

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach((f) => uploadMutation.mutate(f));
  };

  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={20} className="text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-800">Project Files</h2>
          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">{files.length}</span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
        >
          {uploadMutation.isPending
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Upload size={15} />}
          Upload File
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Drop zone (shown when empty or always as background hint) */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          'min-h-[200px] rounded-xl border-2 border-dashed transition-colors',
          dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white',
        )}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <FolderOpen size={36} className="opacity-30" />
            <p className="text-sm">No files yet — drag & drop or click Upload</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                <div className="shrink-0">
                  <FileIcon mime={file.mime_type} size={28} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{file.original_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatBytes(file.size)} · {formatDate(file.created_at)}
                    {file.uploader_name && <> · by <span className="text-gray-500">{file.uploader_name}</span></>}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isPreviewable(file.mime_type) && (
                    <button
                      onClick={() => setPreview(file)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  <a
                    href={file.url}
                    download={file.original_name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download size={16} />
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => deleteMutation.mutate(file.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileIcon mime={preview.mime_type} size={18} />
                <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">{preview.original_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={preview.url}
                  download={preview.original_name}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Download size={14} /> Download
                </a>
                <button
                  onClick={() => setPreview(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl">
              {preview.mime_type.startsWith('image/') ? (
                <img src={preview.url} alt={preview.original_name} className="w-full h-full object-contain p-4" />
              ) : (
                <iframe src={preview.url} className="w-full h-full min-h-[70vh]" title={preview.original_name} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
