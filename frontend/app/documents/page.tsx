"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  Database,
  Eye,
  AlertCircle,
  FileSpreadsheet,
  FileCode2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { DocumentResponse } from '@/lib/api/types';
import { documentsApi } from '@/lib/api/documents';
import { useToast } from '@/context/toast-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonTableRow } from '@/components/ui/skeleton';

export default function DocumentsPage() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'index' | 'ingest' | 'inspector'>('index');
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    documentsApi
      .getDocuments()
      .then((data) => {
        if (active) setDocuments(data || []);
      })
      .catch((err: unknown) => {
        if (active) {
          const detail =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
            'Failed to fetch documents from backend.';
          toast.error(detail, 'API Error');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const validExtensions = ['.pdf', '.docx', '.txt', '.csv', '.xlsx'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validExtensions.includes(fileExt)) {
        setUploadError(`Invalid file format: ${fileExt}. Supported: PDF, DOCX, TXT, CSV, XLSX.`);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(10);
    setUploadSuccess(false);
    setUploadError(null);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 150);

    try {
      const newDoc = await documentsApi.uploadDocument(selectedFile);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedFile(null);
      setUploadSuccess(true);
      toast.success(`Document "${newDoc.name}" uploaded and indexed!`, 'Ingestion Complete');
      setTimeout(() => {
        setUploadSuccess(false);
        setActiveTab('index');
      }, 1500);
    } catch (err: unknown) {
      clearInterval(progressInterval);
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to upload document to backend API.';
      setUploadError(detail);
      toast.error(detail, 'Upload Failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete Knowledge Document',
      message: `Delete knowledge document "${name}"? This permanently purges its record and semantic vector embeddings from pgvector.`,
      confirmText: 'Yes, Delete Document',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      await documentsApi.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success(`Document "${name}" purged from vault.`, 'Document Deleted');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete document on backend API.';
      toast.error(detail, 'Delete Error');
    }
  };

  const handleDownload = async (id: string, filename: string) => {
    try {
      await documentsApi.downloadDocument(id, filename);
      toast.info(`Downloading "${filename}"...`, 'File Download');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        `Error downloading ${filename}`;
      toast.error(detail, 'Download Error');
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '0.0 KB';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getFileIcon = (mimeOrExt?: string | null) => {
    const val = (mimeOrExt || '').toLowerCase();
    if (val.includes('pdf')) return <FileText className="w-4 h-4 text-rose-400 shrink-0" />;
    if (val.includes('csv') || val.includes('excel') || val.includes('spreadsheet'))
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />;
    return <FileCode2 className="w-4 h-4 text-cyan-400 shrink-0" />;
  };

  const filteredDocs = documents.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalBytes = documents.reduce((acc, d) => acc + (d.size_bytes || 0), 0);
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunk_count || 12), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Tab Controls */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Knowledge Vault & Vector RAG</h1>
              <Badge variant="cyan">HNSW Index</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Secure, air-gapped document extraction and pgvector HNSW indexing for autonomous agents.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-medium self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('index')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'index'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Catalog ({documents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ingest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'ingest'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Ingest Document</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inspector')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'inspector'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Chunk Inspector</span>
            </button>
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 block">TOTAL DOCUMENTS</span>
            <span className="text-sm font-bold text-zinc-100">{documents.length} Files</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 block">TOTAL STORAGE</span>
            <span className="text-sm font-bold text-cyan-400">{formatFileSize(totalBytes)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 block">SEMANTIC CHUNKS</span>
            <span className="text-sm font-bold text-emerald-400">~{totalChunks} Vectors</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 block">AIR-GAP SECURITY</span>
            <span className="text-sm font-bold text-zinc-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Local Only
            </span>
          </div>
        </div>
      </div>

      {/* TAB 1: KNOWLEDGE INDEX TABLE */}
      {activeTab === 'index' && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents by name or keyword..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('ingest')}
                className="gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload New Document</span>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-zinc-800/60">
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 space-y-3">
              <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-zinc-300">
                {search ? 'No matching documents found' : 'No documents in Knowledge Vault'}
              </div>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {search
                  ? `No indexed files match "${search}". Try clearing your search query.`
                  : 'Ingest company manuals, blueprints, or spreadsheets to enable agent RAG retrieval.'}
              </p>
              {!search && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setActiveTab('ingest')}
                  className="mt-2"
                >
                  Ingest First Document
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-mono uppercase text-[10px]">
                    <th className="py-3 px-4">Document Designation</th>
                    <th className="py-3 px-4">Format</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Vector Status</th>
                    <th className="py-3 px-4">Ingestion Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-zinc-200">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(doc.mime_type || doc.name)}
                          <div className="min-w-0">
                            <span className="truncate block font-semibold text-zinc-100 max-w-xs sm:max-w-md">
                              {doc.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500 block truncate">
                              ID: {doc.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-400 uppercase text-[11px]">
                        {doc.mime_type?.split('/')[1] || doc.file_type || 'PDF'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-400 text-[11px]">
                        {formatFileSize(doc.size_bytes)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {doc.status || 'Indexed'} ({doc.chunk_count || 12} chunks)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500 text-[11px]">
                        {new Date(doc.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id, doc.name)}
                            title="Download Document"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id, doc.name)}
                            title="Delete Document"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INGEST DOCUMENT DRAG & DROP UPLOADER */}
      {activeTab === 'ingest' && (
        <div className="glass-card p-8 max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-base font-bold text-zinc-100">Ingest Knowledge Document</h2>
            <p className="text-xs text-zinc-400">
              Supported formats: PDF, DOCX, TXT, CSV, XLSX. Documents are chunked and vectorized locally with zero external network egress.
            </p>
          </div>

          {uploadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">Document successfully uploaded and indexed in pgvector!</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{uploadError}</span>
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-5">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                  : 'border-zinc-700/80 hover:border-cyan-500/50 bg-zinc-950/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.csv,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div className="text-sm font-semibold text-zinc-100">
                {selectedFile ? selectedFile.name : 'Click to select or drag & drop document'}
              </div>

              <p className="text-xs text-zinc-500 mt-1 font-mono">
                {selectedFile
                  ? `${formatFileSize(selectedFile.size)} · Ready to ingest`
                  : 'PDF, DOCX, TXT, CSV, XLSX (Up to 100MB)'}
              </p>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>Extracting Text & Generating Vectors...</span>
                  <span className="text-cyan-400">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              disabled={!selectedFile || isUploading}
              className="w-full justify-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              {isUploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Processing & Ingesting...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Upload Document to Vault</span>
                </>
              )}
            </Button>
          </form>
        </div>
      )}

      {/* TAB 3: CHUNK INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="glass-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Vector Index & Chunk Inspector</h2>
              <p className="text-xs text-zinc-400">
                Inspect partitioned text chunks and embedding metadata stored in pgvector.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-cyan-400 self-start sm:self-auto">
              Embeddings: 384-dim HNSW Cosine
            </span>
          </div>

          {documents.length === 0 ? (
            <div className="p-10 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs text-zinc-500 font-mono">
              No documents currently indexed. Ingest a document to inspect vector chunk distributions.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(doc.mime_type || doc.name)}
                        <span className="text-xs font-bold text-zinc-100 truncate">{doc.name}</span>
                      </div>
                      <Badge variant="active">HNSW Ready</Badge>
                    </div>

                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs font-mono text-zinc-300 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">FORMAT:</span>
                        <span>{doc.mime_type || 'application/pdf'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">SIZE:</span>
                        <span>{formatFileSize(doc.size_bytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">VECTOR CHUNKS:</span>
                        <span className="text-emerald-400">~{doc.chunk_count || 12} Chunks</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">INGESTED:</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-500 truncate max-w-[200px]">ID: {doc.id}</span>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id, doc.name)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Download</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
