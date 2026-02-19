import { useState, useRef, useCallback } from 'react';
import { FileUp, X, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { documentsApi } from '@/api';

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
  confidenceScore?: number;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [autoProcess, setAutoProcess] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [accountId, setAccountId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles: UploadFile[] = [];
    Array.from(newFiles).forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        validFiles.push({
          file,
          id: crypto.randomUUID(),
          status: 'error',
          progress: 0,
          error: 'Invalid file type. Accepted: PDF, PNG, JPG, WEBP',
        });
        return;
      }
      if (file.size > MAX_SIZE) {
        validFiles.push({
          file,
          id: crypto.randomUUID(),
          status: 'error',
          progress: 0,
          error: 'File exceeds 10MB limit',
        });
        return;
      }
      validFiles.push({
        file,
        id: crypto.randomUUID(),
        status: 'pending',
        progress: 0,
      });
    });
    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const uploadFile = async (uploadFile: UploadFile) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 30 } : f)),
    );
    try {
      const result = await documentsApi.upload(uploadFile.file, 'default', accountId || undefined);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: autoProcess ? 'processing' : 'done',
                progress: autoProcess ? 60 : 100,
                documentId: result.id,
              }
            : f,
        ),
      );

      if (autoProcess && result.id) {
        try {
          const processResult = await documentsApi.process(result.id);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    status: 'done',
                    progress: 100,
                    confidenceScore: processResult.confidenceScore,
                  }
                : f,
            ),
          );
        } catch {
          setFiles((prev) =>
            prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'done', progress: 100 } : f)),
          );
        }
      }
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error',
                progress: 0,
                error: err instanceof Error ? err.message : 'Upload failed',
              }
            : f,
        ),
      );
    }
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => f.status === 'pending');
    for (const f of pending) {
      await uploadFile(f);
    }
    onUploadComplete?.();
  };

  const retryFile = async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined } : f,
      ),
    );
    await uploadFile(file);
    onUploadComplete?.();
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const doneCount = files.filter((f) => f.status === 'done').length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`neu-inset rounded-xl p-8 border-2 border-dashed transition-all cursor-pointer ${
          isDragging ? 'border-cba-gold bg-cba-gold/5' : 'border-border hover:border-border'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="neu-raised p-4 rounded-2xl">
            <FileUp className={`h-8 w-8 ${isDragging ? 'text-cba-gold' : 'text-secondary'}`} />
          </div>
          <div>
            <p className="text-primary font-semibold">Drop files here or click to browse</p>
            <p className="text-muted text-sm mt-1">PDF, PNG, JPG, WEBP - Max 10MB per file</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Options */}
      <div className="neu-raised rounded-xl p-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoProcess}
            onChange={(e) => setAutoProcess(e.target.checked)}
            className="rounded border-border bg-overlay text-cba-gold focus:ring-[#FFCC00]/20"
          />
          <span className="text-sm text-primary">Auto-process after upload</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Account:</span>
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Optional account ID"
            className="px-3 py-1.5 rounded-lg text-sm bg-overlay border border-border text-primary placeholder:text-zinc-600 focus:ring-1 focus:ring-[#FFCC00]/20 focus:outline-none"
          />
        </div>
        {pendingCount > 0 && (
          <button
            onClick={uploadAll}
            className="ml-auto px-4 py-2 rounded-lg bg-cba-gold text-base font-bold text-sm hover:bg-cba-gold/90 transition-colors"
          >
            Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* File Queue */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">
              Upload Queue ({doneCount}/{files.length} complete)
            </h3>
            {doneCount === files.length && files.length > 0 && (
              <button
                onClick={() => setFiles([])}
                className="text-xs text-muted hover:text-primary transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          {files.map((f) => (
            <div key={f.id} className="neu-raised rounded-xl p-3 flex items-center gap-3">
              <div className="shrink-0">
                {f.status === 'done' && <CheckCircle className="h-5 w-5 text-green-400" />}
                {f.status === 'error' && <XCircle className="h-5 w-5 text-red-400" />}
                {f.status === 'uploading' && (
                  <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                )}
                {f.status === 'processing' && (
                  <Loader2 className="h-5 w-5 text-cba-gold animate-spin" />
                )}
                {f.status === 'pending' && <FileUp className="h-5 w-5 text-muted" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-primary font-medium truncate">{f.file.name}</span>
                  <span className="text-xs text-muted shrink-0">
                    {f.file.size > 5 * 1024 * 1024 && f.status === 'pending' && (
                      <span className="text-amber-400 mr-2 inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Large file
                      </span>
                    )}
                    {(f.file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                {(f.status === 'uploading' || f.status === 'processing') && (
                  <Progress value={f.progress} className="h-1.5 mt-1.5" />
                )}
                {f.error && <p className="text-xs text-red-400 mt-1">{f.error}</p>}
                {f.confidenceScore != null && f.status === 'done' && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted">Confidence:</span>
                    <Badge
                      variant={
                        f.confidenceScore > 80
                          ? 'success'
                          : f.confidenceScore > 50
                            ? 'warning'
                            : 'destructive'
                      }
                    >
                      {f.confidenceScore}%
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {f.status === 'error' && (
                  <button
                    onClick={() => retryFile(f.id)}
                    className="px-2 py-1 text-xs rounded-md bg-overlay text-primary hover:bg-overlay-hover transition-colors"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => removeFile(f.id)}
                  className="p-1 rounded-md hover:bg-overlay-hover text-muted hover:text-primary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
