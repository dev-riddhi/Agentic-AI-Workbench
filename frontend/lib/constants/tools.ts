import {
  FileText,
  FilePlus,
  FileEdit,
  Trash2,
  Search,
  FileSearch,
  BookOpen,
  Globe,
  ExternalLink,
  FileCode2,
  Share2,
  Newspaper,
  Image as ImageIcon,
  Webhook,
  Database,
  Mail,
  FolderClosed,
  BellRing,
  FileDown,
  LucideIcon,
} from 'lucide-react';

export interface ToolDefinition {
  id: string;
  name: string;
  displayName: string;
  category: 'files' | 'documents' | 'web' | 'code' | 'legacy';
  description: string;
  riskLevel: 'safe' | 'medium' | 'restricted';
  requiresSandboxing?: boolean;
  parametersHint: string;
  icon: LucideIcon;
}

export interface ToolCategoryGroup {
  id: 'files' | 'documents' | 'web' | 'code' | 'legacy';
  title: string;
  description: string;
  tools: ToolDefinition[];
}

export const WORKBENCH_TOOLS: ToolDefinition[] = [
  // --- Category: File Operations & CRUD ---
  {
    id: 'read_file',
    name: 'read_file',
    displayName: 'Read File (Multi-Format)',
    category: 'files',
    description: 'Reads and automatically extracts content from PDF, Excel (.xlsx, .xls), CSV, Word (.docx), PowerPoint (.pptx), and text files.',
    riskLevel: 'safe',
    parametersHint: 'file_path, max_rows, max_pages, sheet_name, delimiter, start_line, end_line',
    icon: FileText,
  },
  {
    id: 'write_create_file',
    name: 'write_create_file',
    displayName: 'Write / Create File',
    category: 'files',
    description: 'Creates or overwrites files inside the outputs folder and registers them in agent outputs.',
    riskLevel: 'medium',
    parametersHint: 'file_path, content, mode, overwrite',
    icon: FilePlus,
  },
  {
    id: 'create_pdf_from_markdown',
    name: 'create_pdf_from_markdown',
    displayName: 'Create PDF from Markdown',
    category: 'documents',
    description: 'Generates a styled, publication-ready PDF deliverable from markdown text and saves it into the outputs directory.',
    riskLevel: 'safe',
    parametersHint: 'file_path, markdown_content, title, page_size, theme_color',
    icon: FileDown,
  },
  {
    id: 'edit_file',
    name: 'edit_file',
    displayName: 'Edit File',
    category: 'files',
    description: 'Performs precise find-and-replace text modifications within an existing file.',
    riskLevel: 'medium',
    parametersHint: 'file_path, target_content, replacement_content, is_regex',
    icon: FileEdit,
  },
  {
    id: 'delete_rename_file',
    name: 'delete_rename_file',
    displayName: 'Delete / Rename File',
    category: 'files',
    description: 'Safely removes or renames local files within allowed workspace paths.',
    riskLevel: 'restricted',
    parametersHint: 'source_path, action, target_path',
    icon: Trash2,
  },
  {
    id: 'search_files',
    name: 'search_files',
    displayName: 'Search Files',
    category: 'files',
    description: 'Searches for files matching wildcard patterns or containing specific keywords.',
    riskLevel: 'safe',
    parametersHint: 'query, directory_path, file_pattern, is_regex',
    icon: Search,
  },
  {
    id: 'get_file_metadata',
    name: 'get_file_metadata',
    displayName: 'File Metadata',
    category: 'files',
    description: 'Retrieves file stats, modification timestamps, mime type, and SHA-256 hash.',
    riskLevel: 'safe',
    parametersHint: 'file_path, compute_hash',
    icon: FileSearch,
  },

  // --- Category: Web & External Network ---
  {
    id: 'web_search',
    name: 'web_search',
    displayName: 'Web Search',
    category: 'web',
    description: 'Performs web searches via public endpoints with zero API keys required.',
    riskLevel: 'safe',
    parametersHint: 'query, max_results, safe_search',
    icon: Globe,
  },
  {
    id: 'fetch_webpage',
    name: 'fetch_webpage',
    displayName: 'Fetch Webpage HTML',
    category: 'web',
    description: 'Fetches raw HTTP/HTTPS HTML response with SSRF protection.',
    riskLevel: 'medium',
    parametersHint: 'url, headers, timeout',
    icon: ExternalLink,
  },
  {
    id: 'extract_webpage_content',
    name: 'extract_webpage_content',
    displayName: 'Extract Web Content',
    category: 'web',
    description: 'Extracts cleaned text, reader mode markdown, and metadata from web content.',
    riskLevel: 'safe',
    parametersHint: 'url, output_format, include_links',
    icon: FileCode2,
  },
  {
    id: 'browse_links',
    name: 'browse_links',
    displayName: 'Browse Links & Hyperlinks',
    category: 'web',
    description: 'Discovers and maps hyperlinks within web pages for crawling and navigation.',
    riskLevel: 'safe',
    parametersHint: 'url, filter_pattern, max_links',
    icon: Share2,
  },
  {
    id: 'search_news',
    name: 'search_news',
    displayName: 'Search News & Bulletins',
    category: 'web',
    description: 'Searches recent news articles and RSS feeds via DuckDuckGo news endpoints.',
    riskLevel: 'safe',
    parametersHint: 'query, max_results, region',
    icon: Newspaper,
  },
  {
    id: 'search_images',
    name: 'search_images',
    displayName: 'Search Image References',
    category: 'web',
    description: 'Discovers image URLs, thumbnails, and dimensions via DuckDuckGo image search.',
    riskLevel: 'safe',
    parametersHint: 'query, max_results, safesearch',
    icon: ImageIcon,
  },

  // --- Category: Code & API Execution ---
  {
    id: 'query_apis',
    name: 'query_apis',
    displayName: 'REST API Query',
    category: 'code',
    description: 'Dispatches structured REST requests (GET, POST, PUT, DELETE, PATCH) with payload control.',
    riskLevel: 'medium',
    parametersHint: 'url, method, json_data, headers, params',
    icon: Webhook,
  },

  // --- Category: Legacy / Convenience Aliases ---
  {
    id: 'Database',
    name: 'Database',
    displayName: 'Relational Database',
    category: 'legacy',
    description: 'Query relational tables and execute structured analytics queries.',
    riskLevel: 'medium',
    parametersHint: 'query, table, limit',
    icon: Database,
  },
  {
    id: 'Documents',
    name: 'Documents',
    displayName: 'Knowledge Vault RAG',
    category: 'legacy',
    description: 'Perform semantic vector retrieval and read uploaded files.',
    riskLevel: 'safe',
    parametersHint: 'query, collection_id, top_k',
    icon: FolderClosed,
  },
  {
    id: 'Email',
    name: 'Email',
    displayName: 'Email Dispatch',
    category: 'legacy',
    description: 'Draft and dispatch email summaries to operational team members.',
    riskLevel: 'medium',
    parametersHint: 'to, subject, body',
    icon: Mail,
  },
  {
    id: 'system_notification',
    name: 'system_notification',
    displayName: 'System Notification',
    category: 'legacy',
    description: 'Displays a live alert notification toast in the frontend interface and records it in the notification center.',
    riskLevel: 'safe',
    parametersHint: 'message, title, type',
    icon: BellRing,
  },
];

export const TOOL_CATEGORIES: ToolCategoryGroup[] = [
  {
    id: 'files',
    title: 'File System Operations',
    description: 'Multi-format file reading, outputs generation, editing, and searching',
    tools: WORKBENCH_TOOLS.filter((t) => t.category === 'files'),
  },
  {
    id: 'documents',
    title: 'Documents & Deliverables',
    description: 'PDF report generation from markdown and document synthesis',
    tools: WORKBENCH_TOOLS.filter((t) => t.category === 'documents'),
  },
  {
    id: 'web',
    title: 'Web & Network Access',
    description: 'Air-gapped proxy web search, link scraping, news, and image discovery',
    tools: WORKBENCH_TOOLS.filter((t) => t.category === 'web'),
  },
  {
    id: 'code',
    title: 'API Execution',
    description: 'Loopback REST API dispatchers and HTTP operations',
    tools: WORKBENCH_TOOLS.filter((t) => t.category === 'code'),
  },
  {
    id: 'legacy',
    title: 'Standard Capabilities',
    description: 'Built-in RAG documents, SQLite query interface, and notification dispatch',
    tools: WORKBENCH_TOOLS.filter((t) => t.category === 'legacy'),
  },
];

export const PROMPT_STARTERS = [
  {
    id: 'diagnostic',
    title: 'Industrial Diagnostics',
    description: 'Identify machine telemetry anomalies and parse hydraulic/electrical manuals.',
    prompt: `You are an Autonomous Industrial Diagnostics Specialist operating in an air-gapped sovereign environment.
Your mission is to:
1. Ingest telemetry logs, sensor values, and maintenance PDF manuals.
2. Cross-reference operating pressure, temperature, and vibration with normal tolerances.
3. Diagnose root cause failures and output step-by-step mechanical remediation procedures with ISO compliance references.`,
    recommendedTools: ['read_file', 'write_create_file', 'create_pdf_from_markdown', 'search_files'],
  },
  {
    id: 'document-auditor',
    title: 'Regulatory Document Auditor',
    description: 'Scan PDFs, spreadsheets, and technical specs for compliance gaps.',
    prompt: `You are an Autonomous Compliance & Technical Document Auditor.
Your responsibility:
1. Deep-scan uploaded technical specifications, blueprints, and PDF regulatory documents.
2. Extract tabular figures, safety constraints, and chemical thresholds.
3. Flag discrepancies, deviations from standards, and generate structured executive audit reports.`,
    recommendedTools: ['read_file', 'create_pdf_from_markdown', 'search_files', 'write_create_file'],
  },
  {
    id: 'code-analyst',
    title: 'Air-Gapped Data Analyst',
    description: 'Analyze tabular datasets, verify metrics, and produce publication-ready PDF reports.',
    prompt: `You are an Air-Gapped Data Automation & Reporting Agent.
Your tasks:
1. Read tabular data, spreadsheets, and configuration files from the local workspace.
2. Synthesize key trends, anomalies, and statistical conclusions.
3. Compile a styled, executive PDF report deliverable using create_pdf_from_markdown.`,
    recommendedTools: ['read_file', 'write_create_file', 'create_pdf_from_markdown', 'search_files'],
  },
  {
    id: 'intranet-researcher',
    title: 'Intranet Knowledge Researcher',
    description: 'Index internal documentation, search local wikis, and synthesize answers.',
    prompt: `You are an Autonomous Intranet Knowledge Researcher.
Your mission:
1. Perform keyword and semantic searches across local intranet portals and internal document stores.
2. Extract clean summaries, link citations, and author metadata.
3. Compile concise operational briefings with zero hallucination.`,
    recommendedTools: ['web_search', 'fetch_webpage', 'extract_webpage_content', 'browse_links'],
  },
];
