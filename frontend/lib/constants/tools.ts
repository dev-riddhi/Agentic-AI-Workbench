import {
  FileText,
  FilePlus,
  FileEdit,
  Trash2,
  FolderTree,
  Search,
  FileSearch,
  Archive,
  BookOpen,
  FileSpreadsheet,
  Globe,
  ExternalLink,
  FileCode2,
  Share2,
  Newspaper,
  Image as ImageIcon,
  Download,
  Webhook,
  Terminal,
  Database,
  Mail,
  FolderClosed,
  BellRing,
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
  // --- Category: File Operations ---
  {
    id: 'read_file',
    name: 'read_file',
    displayName: 'Read File',
    category: 'files',
    description: 'Reads text content from a specified file with optional line-range or byte-size slicing.',
    riskLevel: 'safe',
    parametersHint: 'file_path, start_line, end_line, max_bytes',
    icon: FileText,
  },
  {
    id: 'write_create_file',
    name: 'write_create_file',
    displayName: 'Write / Create File',
    category: 'files',
    description: 'Creates a new file or overwrites an existing file with provided text content.',
    riskLevel: 'medium',
    parametersHint: 'file_path, content, overwrite',
    icon: FilePlus,
  },
  {
    id: 'edit_file',
    name: 'edit_file',
    displayName: 'Edit File',
    category: 'files',
    description: 'Performs precise find-and-replace text modifications within an existing file.',
    riskLevel: 'medium',
    parametersHint: 'file_path, target_text, replacement_text',
    icon: FileEdit,
  },
  {
    id: 'delete_rename_file',
    name: 'delete_rename_file',
    displayName: 'Delete / Rename File',
    category: 'files',
    description: 'Safely removes or renames local files and directories within allowed workspace paths.',
    riskLevel: 'restricted',
    parametersHint: 'file_path, action, new_name',
    icon: Trash2,
  },
  {
    id: 'list_directory',
    name: 'list_directory',
    displayName: 'List Directory',
    category: 'files',
    description: 'Recursively lists directory contents, file sizes, and subfolder structures.',
    riskLevel: 'safe',
    parametersHint: 'dir_path, recursive, max_depth',
    icon: FolderTree,
  },
  {
    id: 'search_files',
    name: 'search_files',
    displayName: 'Search Files',
    category: 'files',
    description: 'Searches for files matching wildcard patterns or containing specific keywords.',
    riskLevel: 'safe',
    parametersHint: 'query, search_dir, regex, file_pattern',
    icon: Search,
  },
  {
    id: 'get_file_metadata',
    name: 'get_file_metadata',
    displayName: 'File Metadata',
    category: 'files',
    description: 'Retrieves POSIX/Windows file stats, modification timestamps, and permissions.',
    riskLevel: 'safe',
    parametersHint: 'file_path',
    icon: FileSearch,
  },
  {
    id: 'compress_extract_zip',
    name: 'compress_extract_zip',
    displayName: 'ZIP Archive Handler',
    category: 'files',
    description: 'Compresses file lists into ZIP archives or decompresses archives into targets.',
    riskLevel: 'medium',
    parametersHint: 'action, zip_path, destination, file_list',
    icon: Archive,
  },

  // --- Category: Documents & Structured Knowledge ---
  {
    id: 'parse_pdf',
    name: 'parse_pdf',
    displayName: 'Parse PDF Documents',
    category: 'documents',
    description: 'Extracts formatted text, table structures, and page metadata from PDF manuals.',
    riskLevel: 'safe',
    parametersHint: 'file_path, start_page, end_page, extract_tables',
    icon: BookOpen,
  },
  {
    id: 'read_write_csv_excel_json_xml',
    name: 'read_write_csv_excel_json_xml',
    displayName: 'Structured Data Handler',
    category: 'documents',
    description: 'Bi-directional read/write for CSV, XLSX, JSON, and XML structured data.',
    riskLevel: 'safe',
    parametersHint: 'file_path, format, action, data',
    icon: FileSpreadsheet,
  },

  // --- Category: Web & External Network (Air-Gapped Proxy) ---
  {
    id: 'web_search',
    name: 'web_search',
    displayName: 'Web / Intranet Search',
    category: 'web',
    description: 'Queries search index or air-gapped intranet mirror for query matches.',
    riskLevel: 'safe',
    parametersHint: 'query, max_results, filter_domain',
    icon: Globe,
  },
  {
    id: 'fetch_webpage',
    name: 'fetch_webpage',
    displayName: 'Fetch Webpage HTML',
    category: 'web',
    description: 'Fetches raw HTTP/HTTPS HTML response from allowed domain whitelist.',
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
    parametersHint: 'url, output_format',
    icon: FileCode2,
  },
  {
    id: 'browse_links',
    name: 'browse_links',
    displayName: 'Browse Links & Hyperlinks',
    category: 'web',
    description: 'Discovers and maps hyperlinks within web pages for crawling and navigation.',
    riskLevel: 'safe',
    parametersHint: 'url, depth, same_domain_only',
    icon: Share2,
  },
  {
    id: 'search_news',
    name: 'search_news',
    displayName: 'Search News & Bulletins',
    category: 'web',
    description: 'Searches industry advisories, RSS feeds, and technical news releases.',
    riskLevel: 'safe',
    parametersHint: 'topic, date_range, language',
    icon: Newspaper,
  },
  {
    id: 'search_images',
    name: 'search_images',
    displayName: 'Search Image References',
    category: 'web',
    description: 'Discovers schematic diagrams and technical image assets from catalog.',
    riskLevel: 'safe',
    parametersHint: 'keywords, max_items',
    icon: ImageIcon,
  },
  {
    id: 'download_files',
    name: 'download_files',
    displayName: 'Download Files',
    category: 'web',
    description: 'Streams files from HTTP endpoints directly into designated workspace folders.',
    riskLevel: 'restricted',
    parametersHint: 'url, destination_path, verify_checksum',
    icon: Download,
  },

  // --- Category: Code & API Execution ---
  {
    id: 'query_apis',
    name: 'query_apis',
    displayName: 'REST API Query',
    category: 'code',
    description: 'Dispatches structured REST requests (GET, POST, PUT, DELETE) with payload control.',
    riskLevel: 'medium',
    parametersHint: 'endpoint, method, payload, auth_header',
    icon: Webhook,
  },
  {
    id: 'python_execution',
    name: 'python_execution',
    displayName: 'Isolated Python Execution',
    category: 'code',
    description: 'Executes analytical scripts, calculations, and pandas routines in a sandboxed subprocess.',
    riskLevel: 'restricted',
    requiresSandboxing: true,
    parametersHint: 'code, timeout_seconds, pass_variables',
    icon: Terminal,
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
    description: 'Local workspace file I/O, directory browsing, searching, and archives',
    tools: WORKBENCH_TOOLS.filter((t) => t.category === 'files'),
  },
  {
    id: 'documents',
    title: 'Documents & Structured Data',
    description: 'PDF parsing, Excel/CSV table processing, and JSON/XML transformers',
    tools: WORKBENCH_TOOLS.filter((t) => t.category === 'documents'),
  },
  {
    id: 'web',
    title: 'Web & Network Access',
    description: 'Air-gapped proxy web search, link scraping, downloads, and bulletins',
    tools: WORKBENCH_TOOLS.filter((t) => t.category === 'web'),
  },
  {
    id: 'code',
    title: 'Code Execution & APIs',
    description: 'Sandboxed Python runner and loopback REST API dispatchers',
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
    recommendedTools: ['parse_pdf', 'read_file', 'read_write_csv_excel_json_xml', 'python_execution'],
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
    recommendedTools: ['parse_pdf', 'read_write_csv_excel_json_xml', 'search_files', 'read_file'],
  },
  {
    id: 'code-analyst',
    title: 'Air-Gapped Python Analyst',
    description: 'Execute isolated mathematical models, verify checksums, and aggregate metrics.',
    prompt: `You are an Air-Gapped Code and Analytical Automation Agent.
Your tasks:
1. Read tabular data and configuration files from the local workspace.
2. Execute deterministic Python routines in an isolated environment to compute metrics.
3. Output validated analytical summaries without external network dependencies.`,
    recommendedTools: ['python_execution', 'read_file', 'write_create_file', 'list_directory'],
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
