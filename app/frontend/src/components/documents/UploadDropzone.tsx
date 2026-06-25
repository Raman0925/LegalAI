'use client';

import * as React from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/tiff': ['.tiff', '.tif'],
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

interface UploadDropzoneProps {
  onUploaded: () => void;
}

export function UploadDropzone({ onUploaded }: UploadDropzoneProps) {
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [fileName, setFileName] = React.useState('');

  const onDrop = React.useCallback(
    async (acceptedFiles: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        toast({
          title: 'Unsupported file',
          description: rejections[0]?.errors?.[0]?.message || 'That file type or size is not supported.',
          variant: 'destructive',
        });
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setProgress(0);
      setFileName(file.name);
      try {
        await api.documents.upload(file, setProgress);
        toast({ title: 'Upload started', description: `${file.name} is being processed.` });
        onUploaded();
      } catch (err: any) {
        toast({
          title: 'Upload failed',
          description: err.message || 'Failed to upload document.',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        isDragActive ? 'border-violet-500 bg-violet-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20'
      } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <p className="text-sm text-zinc-300 font-medium truncate max-w-xs">Uploading {fileName}…</p>
          <div className="w-full max-w-xs h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">{progress}%</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-zinc-200">
            {isDragActive ? 'Drop the file here' : 'Drag & drop a document, or click to browse'}
          </p>
          <p className="text-xs text-zinc-500">PDF, DOCX, TXT, JPG, PNG, WEBP, TIFF — up to 25MB</p>
        </div>
      )}
    </div>
  );
}
