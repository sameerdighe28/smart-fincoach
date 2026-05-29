"use client";
import { useState, useCallback } from "react";
import { Upload, X, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { SOURCE_OPTIONS } from "@/lib/utils";

interface UploadResult {
  filename: string;
  row_count: number;
  parse_errors: { errors: string[] } | null;
}

export default function FileUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [sourceType, setSourceType] = useState(SOURCE_OPTIONS[0].value);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.upload(file, sourceType);
      setResult(res);
      onSuccess?.();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [sourceType, onSuccess]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="flex gap-2 flex-wrap">
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSourceType(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              sourceType === opt.value
                ? "bg-brand-600 text-white"
                : "bg-[var(--card)] text-[var(--muted)] hover:text-white border border-[var(--card-border)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-brand-500 bg-brand-500/10"
            : "border-[var(--card-border)] hover:border-brand-500/50"
        }`}
      >
        <input
          type="file"
          accept=".pdf,.csv,.xlsx,.xls"
          onChange={onFileSelect}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-sm text-[var(--muted)]">Parsing & processing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-[var(--muted)]" />
            <p className="text-sm text-[var(--muted)]">
              Drop your <span className="text-white font-medium">PDF, CSV, or Excel</span> statement here
            </p>
            <p className="text-xs text-[var(--muted)]">or click to browse</p>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-400">
              Parsed {result.row_count} transactions from {result.filename}
            </p>
            {result.parse_errors?.errors?.length ? (
              <p className="text-xs text-[var(--muted)] mt-1">
                {result.parse_errors.errors.length} warnings (non-critical)
              </p>
            ) : null}
          </div>
          <button onClick={() => setResult(null)} className="ml-auto">
            <X className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>
      )}
    </div>
  );
}

