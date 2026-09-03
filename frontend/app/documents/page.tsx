"use client";

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { DocumentResponse } from '@/lib/api/types';
import { documentsApi } from '@/lib/api/documents';
import { useToast } from '@/context/toast-context';

export default function DocumentsPage() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'index' | 'ingest' | 'inspector'>('index');
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    documentsApi.getDocuments()
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadSuccess(false);
    setUploadError(null);

    try {
      const newDoc = await documentsApi.uploadDocument(selectedFile);
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedFile(null);
      setUploadSuccess(true);
      toast.success(`Document "${newDoc.name}" uploaded and indexed!`, 'Upload Complete');
      setTimeout(() => setUploadSuccess(false), 3500);
    } catch (err: unknown) {
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
      message: `Delete knowledge document "${name}"? This removes its record and semantic vectors from pgvector.`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      await documentsApi.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success(`Document "${name}" deleted from vault.`, 'Document Deleted');
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

  const filteredDocs = documents.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Knowledge Vault & Vector RAG
          </h2>
          <p className="text-xs text-zinc-400">
            Secure, air-gapped document extraction and HNSW indexing for company agents
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('index')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'index'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Knowledge Index ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ingest')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'ingest'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Ingest Document
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Chunk Inspector
          </button>
        </div>
      </div>

      {/* TAB 1: KNOWLEDGE INDEX TABLE */}
      {activeTab === 'index' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter documents..."
                className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Vector Pipeline: pgvector HNSW
            </span>
          </div>

          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 space-y-2">
              <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-zinc-300">No documents in Knowledge Vault</div>
              <p className="text-xs text-zinc-500">
                Upload manuals, specifications, or reports in the Ingest tab to enable agent RAG retrieval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-mono uppercase text-[10px]">
                    <th className="py-3 px-4">Document Name</th>
                    <th className="py-3 px-4">Format</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Ingested At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-zinc-200 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-sm">{doc.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {doc.mime_type?.split('/')[1] || 'PDF'}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)} KB` : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ● {doc.status || 'indexed'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-500 text-[11px]">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id, doc.name)}
                            title="Download Document"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id, doc.name)}
                            title="Delete Document"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
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

      {/* TAB 2: INGEST DOCUMENT UPLOADER */}
      {activeTab === 'ingest' && (
        <div className="p-8 rounded-2xl bg-zinc-900/70 border border-zinc-800 max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h3 className="text-base font-bold text-zinc-100">Ingest Knowledge Document</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Supported file types: PDF, DOCX, TXT. Ingestion extracts text chunks and stores embeddings in pgvector via FastAPI.
            </p>
          </div>

          {uploadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Document successfully uploaded and indexed in backend!</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{uploadError}</span>
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="relative border-2 border-dashed border-zinc-700 hover:border-cyan-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer bg-zinc-950/40">
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-10 h-10 text-cyan-400 mb-3" />
              <div className="text-sm font-semibold text-zinc-200">
                {selectedFile ? selectedFile.name : 'Choose or drop document here'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                  : 'PDF, DOCX, TXT up to 50MB'}
              </p>
            </div>

            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing & Uploading to Backend...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Upload Document to Vault</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: CHUNK INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Vector Index Inspector</h3>
              <p className="text-xs text-zinc-400">
                Live document records registered in the backend pgvector RAG pipeline
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
              Dimension: 384 (HNSW)
            </span>
          </div>

          {documents.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs text-zinc-500">
              No documents available to inspect. Upload documents in the Ingest tab.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-2">
                      <span className="text-cyan-400 font-bold truncate max-w-xs">{doc.name}</span>
                      <span className="text-emerald-400">Indexed</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mb-2 truncate">
                      Path: {doc.file_path}
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-xs font-mono text-zinc-300 space-y-1">
                      <div>MIME: {doc.mime_type || 'application/pdf'}</div>
                      <div>UUID: {doc.id}</div>
                      <div>Uploaded: {new Date(doc.created_at).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>Index Type: HNSW Cosine</span>
                    <span className="text-emerald-400">Ready for Agent Search</span>
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
