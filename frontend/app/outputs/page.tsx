"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  FolderDown,
  Download,
  Search,
  FileText,
  FileSpreadsheet,
  FileCode2,
  File,
  RefreshCw,
  Trash2,
  Eye,
  Bot,
  Calendar,
  HardDrive,
  Copy,
  Check,
  Filter,
  Layers,
  ArrowUpDown,
  ExternalLink,
  Sparkles,
  Presentation,
} from "lucide-react";
import { AgentOutput, AgentOutputPreview } from "@/lib/api/types";
import { outputsApi } from "@/lib/api/outputs";
import { parseUTCDate } from "@/lib/utils/date";
import { useToast } from "@/context/toast-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SkeletonTableRow } from "@/components/ui/skeleton";

type OutputCategory = "all" | "pdf" | "data" | "json" | "markdown" | "other";

export default function OutputsPage() {
  const { toast, confirm } = useToast();
  const [outputs, setOutputs] = useState<AgentOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<OutputCategory>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Preview Modal State
  const [previewOutput, setPreviewOutput] = useState<AgentOutputPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active download tracker
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadOutputs = async () => {
    setIsLoading(true);
    try {
      const data = await outputsApi.getOutputs();
      setOutputs(data || []);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to fetch agent outputs from backend.";
      toast.error(detail, "API Error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOutputs();
  }, []);

  // Compute unique agents that generated outputs
  const agentList = useMemo(() => {
    const names = new Set<string>();
    outputs.forEach((o) => {
      if (o.agent_name) names.add(o.agent_name);
    });
    return Array.from(names).sort();
  }, [outputs]);

  // Classification helper for category tabs
  const getOutputCategory = (type: string): OutputCategory => {
    const t = (type || "").toLowerCase();
    if (t === "pdf") return "pdf";
    if (["csv", "xlsx", "xls", "tsv"].includes(t)) return "data";
    if (["json", "xml", "yaml", "yml"].includes(t)) return "json";
    if (["markdown", "md", "txt"].includes(t)) return "markdown";
    return "other";
  };

  // Filtered outputs
  const filteredOutputs = useMemo(() => {
    return outputs.filter((o) => {
      // Category filter
      if (categoryFilter !== "all") {
        const cat = getOutputCategory(o.output_type);
        if (cat !== categoryFilter) return false;
      }
      // Agent filter
      if (selectedAgent !== "all" && o.agent_name !== selectedAgent) {
        return false;
      }
      // Search term
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesTitle = o.title.toLowerCase().includes(q);
        const matchesAgent = (o.agent_name || "").toLowerCase().includes(q);
        const matchesType = (o.output_type || "").toLowerCase().includes(q);
        const matchesPreview = (o.content_preview || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesAgent && !matchesType && !matchesPreview) {
          return false;
        }
      }
      return true;
    });
  }, [outputs, categoryFilter, selectedAgent, search]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = outputs.length;
    let pdfCount = 0;
    let dataCount = 0;
    let mdCount = 0;
    let totalBytes = 0;

    outputs.forEach((o) => {
      const cat = getOutputCategory(o.output_type);
      if (cat === "pdf") pdfCount++;
      else if (cat === "data") dataCount++;
      else if (cat === "markdown") mdCount++;

      if (o.file_size) totalBytes += o.file_size;
    });

    return { total, pdfCount, dataCount, mdCount, totalBytes };
  }, [outputs]);

  // Human-readable file size formatter
  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Human-readable relative date formatter
  const formatDate = (isoStr: string): string => {
    try {
      const d = parseUTCDate(isoStr);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  // Get File Type Icon & Style Badge
  const getFileBadge = (outputType: string) => {
    const t = (outputType || "").toLowerCase();
    switch (t) {
      case "pdf":
        return {
          icon: FileText,
          label: "PDF",
          badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
          iconColor: "text-red-500",
        };
      case "csv":
        return {
          icon: FileSpreadsheet,
          label: "CSV",
          badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          iconColor: "text-emerald-500",
        };
      case "xlsx":
      case "xlsl":
      case "xls":
        return {
          icon: FileSpreadsheet,
          label: "XLSX",
          badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          iconColor: "text-emerald-500",
        };
      case "docx":
      case "docs":
      case "doc":
      case "word":
        return {
          icon: FileText,
          label: "DOCX",
          badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          iconColor: "text-blue-500",
        };
      case "pptx":
      case "ppt":
      case "presentation":
        return {
          icon: Presentation,
          label: "PPTX",
          badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
          iconColor: "text-orange-500",
        };
      case "json":
      case "xml":
      case "yaml":
        return {
          icon: FileCode2,
          label: t.toUpperCase(),
          badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          iconColor: "text-amber-500",
        };
      case "markdown":
      case "md":
      case "txt":
        return {
          icon: FileText,
          label: t === "markdown" ? "MD" : t.toUpperCase(),
          badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
          iconColor: "text-cyan-500",
        };
      default:
        return {
          icon: File,
          label: t.toUpperCase() || "FILE",
          badgeClass: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
          iconColor: "text-zinc-400",
        };
    }
  };

  // Handle file download
  const handleDownload = async (output: AgentOutput) => {
    setDownloadingId(output.id);
    try {
      let targetName = output.title;
      if (output.file_path) {
        const parts = output.file_path.replace(/\\/g, '/').split('/');
        const realFileName = parts[parts.length - 1];
        if (realFileName && realFileName.includes('.')) {
          targetName = output.title?.includes('.') ? output.title : realFileName;
        }
      }

      await outputsApi.downloadOutput(output.id, targetName, output.output_type);
      toast.success(`Download started for ${targetName || output.title}`);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Download failed. The file may no longer be available on the server.";
      toast.error(detail, "Download Failed");
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle open preview modal
  const handleOpenPreview = async (output: AgentOutput) => {
    setIsPreviewLoading(true);
    setPreviewModalOpen(true);
    setCopied(false);
    try {
      const prev = await outputsApi.previewOutput(output.id);
      setPreviewOutput(prev);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to load preview.";
      toast.error(detail, "Preview Error");
      setPreviewModalOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Handle delete output record
  const handleDelete = async (output: AgentOutput) => {
    const ok = await confirm({
      title: "Delete Output",
      message: `Are you sure you want to permanently delete '${output.title}'? This cannot be undone.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

    try {
      await outputsApi.deleteOutput(output.id);
      setOutputs((prev) => prev.filter((o) => o.id !== output.id));
      toast.success(`'${output.title}' was deleted successfully.`);
      if (previewOutput?.id === output.id) {
        setPreviewModalOpen(false);
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to delete output record.";
      toast.error(detail, "Delete Error");
    }
  };

  const handleCopyPreviewContent = () => {
    if (!previewOutput?.content) return;
    void navigator.clipboard.writeText(previewOutput.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Content copied to clipboard");
  };

  return (
    <div className="flex flex-col min-h-full space-y-6 pb-12">
      {/* Top Header / Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Deliverables */}
        <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Deliverables</span>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {isLoading ? "—" : stats.total}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]">
              <FolderDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-cyan-500" />
            <span>Storage: {formatFileSize(stats.totalBytes)}</span>
          </div>
        </div>

        {/* PDFs & Documents */}
        <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-red-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">PDF Documents</span>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {isLoading ? "—" : stats.pdfCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span>Compiled reports & briefs</span>
          </div>
        </div>

        {/* Data & Tables */}
        <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Data & Sheets</span>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {isLoading ? "—" : stats.dataCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>CSV, Excel & structured tables</span>
          </div>
        </div>

        {/* Reports & Markdown */}
        <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Markdown & Text</span>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {isLoading ? "—" : stats.mdCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
              <FileCode2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Execution briefs & code snippets</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category Tabs, Agent Filter, Refresh */}
      <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              id="outputs-search-input"
              type="text"
              placeholder="Search by file name, agent, format, or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Agent Filter Dropdown */}
            {agentList.length > 0 && (
              <div className="relative flex items-center">
                <Bot className="absolute left-3 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                <select
                  id="outputs-agent-filter"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  aria-label="Filter outputs by producing agent"
                  className="pl-8 pr-7 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 appearance-none cursor-pointer"
                >
                  <option value="all">All Agents ({outputs.length})</option>
                  {agentList.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-xl p-0.5 border border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  viewMode === "table"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Cards
              </button>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadOutputs}
              disabled={isLoading}
              className="gap-1.5 h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-500" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-900">
          {(
            [
              { id: "all", label: "All Outputs", count: outputs.length },
              { id: "pdf", label: "PDF Documents", count: stats.pdfCount },
              { id: "data", label: "Data & Tables", count: stats.dataCount },
              { id: "markdown", label: "Markdown & Text", count: stats.mdCount },
              { id: "json", label: "JSON & Configs", count: outputs.filter((o) => getOutputCategory(o.output_type) === "json").length },
            ] as const
          ).map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${
                  active
                    ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 shadow-[0_0_12px_-2px_rgba(6,182,212,0.25)] font-semibold"
                    : "bg-transparent text-zinc-500 dark:text-zinc-400 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    active
                      ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                      : "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Outputs Content: Table or Grid */}
      {isLoading ? (
        <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm">
          <div className="space-y-4">
            <SkeletonTableRow />
            <SkeletonTableRow />
            <SkeletonTableRow />
            <SkeletonTableRow />
          </div>
        </div>
      ) : filteredOutputs.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-12 text-center shadow-sm">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/10 to-indigo-500/20 flex items-center justify-center mx-auto text-cyan-500 border border-cyan-500/30 shadow-[0_0_25px_-5px_rgba(6,182,212,0.3)]">
              <FolderDown className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {search || categoryFilter !== "all" || selectedAgent !== "all"
                  ? "No matching deliverables found"
                  : "No agent execution outputs yet"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {search || categoryFilter !== "all" || selectedAgent !== "all"
                  ? "Try resetting your search query or filters to view all outputs."
                  : "When agents execute tasks that create PDFs, spreadsheets, data files, or final reports, they will be archived here automatically for inspection and download."}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              {search || categoryFilter !== "all" || selectedAgent !== "all" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                    setSelectedAgent("all");
                  }}
                >
                  Reset Filters
                </Button>
              ) : (
                <Link href="/agents">
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md">
                    <Bot className="w-4 h-4" />
                    <span>Run an Agent</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* Table View */
        <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800/80 text-zinc-500 dark:text-zinc-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Deliverable / File</th>
                  <th className="py-3.5 px-4 font-semibold">Producing Agent</th>
                  <th className="py-3.5 px-4 font-semibold">Format</th>
                  <th className="py-3.5 px-4 font-semibold">File Size</th>
                  <th className="py-3.5 px-4 font-semibold">Generated</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {filteredOutputs.map((output) => {
                  const badgeInfo = getFileBadge(output.output_type);
                  const IconComponent = badgeInfo.icon;
                  const isDownloading = downloadingId === output.id;

                  return (
                    <tr
                      key={output.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30 transition-colors group"
                    >
                      {/* Name & Icon */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${badgeInfo.badgeClass}`}
                          >
                            <IconComponent className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <div
                              onClick={() => handleOpenPreview(output)}
                              className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-xs sm:max-w-md hover:text-cyan-500 dark:hover:text-cyan-400 cursor-pointer transition-colors"
                              title={output.title}
                            >
                              {output.title}
                            </div>
                            {output.file_path && (
                              <div className="text-[10px] text-zinc-400 font-mono truncate max-w-xs">
                                {output.file_path.replace(/\\/g, "/")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Agent Badge */}
                      <td className="py-3.5 px-4">
                        {output.agent_name ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium text-[11px] border border-zinc-200 dark:border-zinc-800">
                            <Bot className="w-3 h-3 text-cyan-500" />
                            <span>{output.agent_name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Format Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono uppercase font-semibold rounded-md border ${badgeInfo.badgeClass}`}
                        >
                          {badgeInfo.label}
                        </span>
                      </td>

                      {/* File Size */}
                      <td className="py-3.5 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                        {formatFileSize(output.file_size)}
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatDate(output.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPreview(output)}
                            className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                            title="Inspect & Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {/* Download Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isDownloading}
                            onClick={() => handleDownload(output)}
                            className="h-8 gap-1.5 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-medium"
                            title="Download Deliverable"
                          >
                            <Download className={`w-3.5 h-3.5 ${isDownloading ? "animate-bounce" : ""}`} />
                            <span className="hidden sm:inline">Download</span>
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(output)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                            title="Delete Deliverable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid / Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOutputs.map((output) => {
            const badgeInfo = getFileBadge(output.output_type);
            const IconComponent = badgeInfo.icon;
            const isDownloading = downloadingId === output.id;

            return (
              <div
                key={output.id}
                className="bg-white dark:bg-[#0e0e11] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm hover:border-cyan-500/40 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Icon, Type Badge, and Actions */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${badgeInfo.badgeClass}`}
                    >
                      <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase font-semibold rounded-md border ${badgeInfo.badgeClass}`}
                      >
                        {badgeInfo.label}
                      </span>
                      <button
                        onClick={() => handleDelete(output)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Delete Deliverable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Path */}
                  <h4
                    onClick={() => handleOpenPreview(output)}
                    className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
                    title={output.title}
                  >
                    {output.title}
                  </h4>

                  {output.file_path && (
                    <p className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                      {output.file_path.replace(/\\/g, "/")}
                    </p>
                  )}

                  {/* Content Preview Excerpt */}
                  {output.content_preview && (
                    <div className="mt-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-3 font-mono leading-relaxed">
                      {output.content_preview}
                    </div>
                  )}
                </div>

                {/* Card Footer: Metadata & Actions */}
                <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    {output.agent_name && (
                      <div className="flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
                        <Bot className="w-3 h-3 text-cyan-500" />
                        <span>{output.agent_name}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-400">
                      {formatFileSize(output.file_size)} • {formatDate(output.created_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenPreview(output)}
                      className="h-8 px-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isDownloading}
                      onClick={() => handleDownload(output)}
                      className="h-8 gap-1.5 font-medium shadow-sm"
                    >
                      <Download className={`w-3.5 h-3.5 ${isDownloading ? "animate-bounce" : ""}`} />
                      <span>Download</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Preview Modal */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={previewOutput?.title || "Deliverable Preview"}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* Metadata banner inside modal */}
          {previewOutput && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Format:</span>
                <span className="font-mono uppercase font-bold text-cyan-600 dark:text-cyan-400">
                  {previewOutput.output_type}
                </span>
                {previewOutput.file_size && (
                  <>
                    <span className="text-zinc-400">•</span>
                    <span className="text-zinc-500 font-mono">{formatFileSize(previewOutput.file_size)}</span>
                  </>
                )}
                {previewOutput.mime_type && (
                  <>
                    <span className="text-zinc-400">•</span>
                    <span className="text-zinc-400 font-mono text-[10px]">{previewOutput.mime_type}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!previewOutput.is_binary && previewOutput.content && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPreviewContent}
                    className="h-7 px-2 gap-1 text-[11px]"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy Content"}</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    const matched = outputs.find((o) => o.id === previewOutput.id);
                    if (matched) void handleDownload(matched);
                  }}
                  className="h-7 px-2.5 gap-1.5 text-[11px] bg-cyan-500 hover:bg-cyan-400 text-white"
                >
                  <Download className="w-3 h-3" />
                  <span>Download File</span>
                </Button>
              </div>
            </div>
          )}

          {/* Content Area */}
          {isPreviewLoading ? (
            <div className="py-12 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
              <span>Loading output content...</span>
            </div>
          ) : previewOutput?.is_binary ? (
            /* Binary Document Notice (PDF, images, etc.) */
            <div className="p-8 text-center space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
                <FileText className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  Binary Document ({previewOutput.output_type.toUpperCase()})
                </h4>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  This deliverable is a compiled binary file. Download it to view in your native PDF viewer or system application.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const matched = outputs.find((o) => o.id === previewOutput.id);
                  if (matched) void handleDownload(matched);
                }}
                className="gap-2 bg-red-500 hover:bg-red-400 text-white font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Download {previewOutput.title}</span>
              </Button>
            </div>
          ) : previewOutput?.content ? (
            /* Text / Markdown / Code Content Area */
            <div className="relative">
              <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto max-h-[60vh] leading-relaxed border border-zinc-800">
                <code>{previewOutput.content}</code>
              </pre>
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-400 text-xs">
              No textual preview available for this deliverable.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
