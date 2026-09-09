"""Agent Tools Registry
Defines the static list of tools where each tool follows the standard tool calling schema,
mapping tool names to callable execution functions.
"""

from typing import Any, Callable

from app.tools.file.read_file import read_file
from app.tools.file.create_file import create_file, write_create_file
from app.tools.utils.create_pdf_from_markdown import create_pdf_from_markdown
from app.tools.utils.create_csv import create_csv
from app.tools.utils.create_excel import create_excel
from app.tools.utils.create_docx import create_docx
from app.tools.utils.create_pptx import create_pptx
from app.tools.file.edit_file import edit_file
from app.tools.file.delete_rename_file import delete_rename_file
from app.tools.file.search_files import search_files
from app.tools.file.get_file_metadata import get_file_metadata
from app.tools.web_search import web_search
from app.tools.fetch_webpage import fetch_webpage
from app.tools.extract_webpage_content import extract_webpage_content
from app.tools.browse_links import browse_links
from app.tools.search_news import search_news
from app.tools.search_images import search_images
from app.tools.query_apis import query_apis
from app.tools.system_notification import system_notification
from app.tools.file.file_security import get_upload_dir, get_outputs_dir, resolve_safe_path, resolve_output_path

# Retain backward-compatible module-level imports for standalone scripts / tests
from app.tools.file.list_directory import list_directory
from app.tools.file.parse_pdf import parse_pdf
from app.tools.file.read_write_csv_excel_json_xml import read_write_csv_excel_json_xml
from app.tools.compress_extract_zip import compress_extract_zip
from app.tools.download_files import download_files
from app.tools.python_execution import python_execution


class ToolFunctionDict(dict):
    """OpenAI function definition dictionary that is also directly callable."""

    def __init__(self, fn: Callable[..., Any], *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self.fn = fn

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        return self.fn(*args, **kwargs)


# Static list of active tools following the standard tool calling dictionary style
# Each dict maps tool_name -> function, type -> "function", and function -> ToolFunctionDict
TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "read_file": read_file,
        "name": "read_file",
        "callable": read_file,
        "handler": read_file,
        "description": "Reads and automatically extracts content from any file inside the uploads directory. Automatically detects rich formats (PDF, Excel, CSV, Word, PowerPoint) and text files.",
        "parameters": {
            "properties": {
                "file_path": {
                    "description": "Path or filename inside uploads (e.g. 'data.xlsx', 'report.pdf', 'summary.txt', 'outputs/final.pdf').",
                    "type": "string",
                },
                "encoding": {
                    "default": "utf-8",
                    "description": "File character encoding for text files.",
                    "type": "string",
                },
                "start_line": {
                    "description": "Optional 1-based start line index for text files.",
                    "type": "integer",
                },
                "end_line": {
                    "description": "Optional 1-based end line index for text files.",
                    "type": "integer",
                },
                "max_bytes": {
                    "description": "Optional limit on the number of bytes to read for text files.",
                    "type": "integer",
                },
                "max_rows": {
                    "description": "Optional maximum rows to extract from Excel or CSV files.",
                    "type": "integer",
                },
                "max_pages": {
                    "description": "Optional maximum pages to extract from PDF files.",
                    "type": "integer",
                },
                "sheet_name": {
                    "description": "Optional sheet name to extract from Excel workbooks.",
                    "type": "string",
                },
                "delimiter": {
                    "description": "Optional custom delimiter for CSV/TSV files (e.g. ',', '\\t', ';').",
                    "type": "string",
                },
            },
            "required": ["file_path"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            read_file,
            name="read_file",
            description="Reads and automatically extracts content from any file inside the uploads directory. Automatically detects rich formats (PDF, Excel, CSV, Word, PowerPoint) and text files.",
            parameters={
                "properties": {
                    "file_path": {
                        "description": "Path or filename inside uploads (e.g. 'data.xlsx', 'report.pdf', 'summary.txt', 'outputs/final.pdf').",
                        "type": "string",
                    },
                    "encoding": {
                        "default": "utf-8",
                        "description": "File character encoding for text files.",
                        "type": "string",
                    },
                    "start_line": {
                        "description": "Optional 1-based start line index for text files.",
                        "type": "integer",
                    },
                    "end_line": {
                        "description": "Optional 1-based end line index for text files.",
                        "type": "integer",
                    },
                    "max_bytes": {
                        "description": "Optional limit on the number of bytes to read for text files.",
                        "type": "integer",
                    },
                    "max_rows": {
                        "description": "Optional maximum rows to extract from Excel or CSV files.",
                        "type": "integer",
                    },
                    "max_pages": {
                        "description": "Optional maximum pages to extract from PDF files.",
                        "type": "integer",
                    },
                    "sheet_name": {
                        "description": "Optional sheet name to extract from Excel workbooks.",
                        "type": "string",
                    },
                    "delimiter": {
                        "description": "Optional custom delimiter for CSV/TSV files (e.g. ',', '\\t', ';').",
                        "type": "string",
                    },
                },
                "required": ["file_path"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "create_file": create_file,
        "name": "create_file",
        "callable": create_file,
        "handler": create_file,
        "description": "Creates output files strictly inside the backend/outputs directory and registers them in the agent_outputs database. Automatically generates the native format requested: Excel (.xlsx), PDF (.pdf), Word (.docx), PowerPoint (.pptx), CSV (.csv), or Markdown (.md).",
        "parameters": {
            "properties": {
                "file_path": {
                    "description": "Destination filename with extension inside backend/outputs/ (e.g. 'sales_data.xlsx', 'report.pdf', 'document.docx', 'presentation.pptx', 'data.csv', 'notes.md').",
                    "type": "string",
                },
                "content": {
                    "description": "Text, markdown, or tabular content. For PDF/Word/Markdown: full markdown text. For Excel/CSV: CSV or tabular markdown. For PowerPoint: markdown with '# Slide Title' for each slide and bullet points.",
                    "type": "string",
                },
                "file_type": {
                    "description": "Exact file format to generate: 'xlsx' (Excel spreadsheet), 'pdf' (PDF document), 'docx' (Word document), 'pptx' (PowerPoint presentation), 'csv' (CSV data), or 'md' (Markdown text). If an unsupported format is provided, creates a .md file.",
                    "type": "string",
                },
                "title": {
                    "description": "Optional human-readable title for the deliverable (e.g. 'Q3 Financial Report').",
                    "type": "string",
                },
                "mode": {
                    "default": "w",
                    "description": "Write mode: 'w' for overwrite/create, 'a' for append.",
                    "enum": ["w", "a"],
                    "type": "string",
                },
                "overwrite": {
                    "default": True,
                    "description": "Whether to allow overwriting if the file already exists.",
                    "type": "boolean",
                },
            },
            "required": ["file_path", "content"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            create_file,
            name="create_file",
            description="Creates output files strictly inside the backend/outputs directory and registers them in the agent_outputs database. Automatically generates the native format requested: Excel (.xlsx), PDF (.pdf), Word (.docx), PowerPoint (.pptx), CSV (.csv), or Markdown (.md).",
            parameters={
                "properties": {
                    "file_path": {
                        "description": "Destination filename with extension inside backend/outputs/ (e.g. 'sales_data.xlsx', 'report.pdf', 'document.docx', 'presentation.pptx', 'data.csv', 'notes.md').",
                        "type": "string",
                    },
                    "content": {
                        "description": "Text, markdown, or tabular content. For PDF/Word/Markdown: full markdown text. For Excel/CSV: CSV or tabular markdown. For PowerPoint: markdown with '# Slide Title' for each slide and bullet points.",
                        "type": "string",
                    },
                    "file_type": {
                        "description": "Exact file format to generate: 'xlsx' (Excel spreadsheet), 'pdf' (PDF document), 'docx' (Word document), 'pptx' (PowerPoint presentation), 'csv' (CSV data), or 'md' (Markdown text). If an unsupported format is provided, creates a .md file.",
                        "type": "string",
                    },
                    "title": {
                        "description": "Optional human-readable title for the deliverable (e.g. 'Q3 Financial Report').",
                        "type": "string",
                    },
                    "mode": {
                        "default": "w",
                        "description": "Write mode: 'w' for overwrite/create, 'a' for append.",
                        "enum": ["w", "a"],
                        "type": "string",
                    },
                    "overwrite": {
                        "default": True,
                        "description": "Whether to allow overwriting if the file already exists.",
                        "type": "boolean",
                    },
                },
                "required": ["file_path", "content"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "create_pdf_from_markdown": create_pdf_from_markdown,
        "name": "create_pdf_from_markdown",
        "callable": create_pdf_from_markdown,
        "handler": create_pdf_from_markdown,
        "description": "Generates a styled, publication-ready PDF deliverable from LLM markdown content (supporting headings, tables, code blocks, lists, blockquotes) and saves it in outputs/, registering it in the agent_outputs database.",
        "parameters": {
            "properties": {
                "file_path": {
                    "description": "Output filename or relative path inside outputs (e.g. 'quarterly_report.pdf').",
                    "type": "string",
                },
                "markdown_content": {
                    "description": "Markdown text generated by the agent to convert into a styled PDF document.",
                    "type": "string",
                },
                "title": {
                    "description": "Optional document title displayed on header / cover.",
                    "type": "string",
                },
                "page_size": {
                    "default": "LETTER",
                    "description": "Page size: 'LETTER' or 'A4'.",
                    "enum": ["LETTER", "A4"],
                    "type": "string",
                },
                "theme_color": {
                    "default": "#1e40af",
                    "description": "Primary hex color for headings and table accents (default: '#1e40af').",
                    "type": "string",
                },
            },
            "required": ["file_path", "markdown_content"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            create_pdf_from_markdown,
            name="create_pdf_from_markdown",
            description="Generates a styled, publication-ready PDF deliverable from LLM markdown content (supporting headings, tables, code blocks, lists, blockquotes) and saves it in outputs/, registering it in the agent_outputs database.",
            parameters={
                "properties": {
                    "file_path": {
                        "description": "Output filename or relative path inside outputs (e.g. 'quarterly_report.pdf').",
                        "type": "string",
                    },
                    "markdown_content": {
                        "description": "Markdown text generated by the agent to convert into a styled PDF document.",
                        "type": "string",
                    },
                    "title": {
                        "description": "Optional document title displayed on header / cover.",
                        "type": "string",
                    },
                    "page_size": {
                        "default": "LETTER",
                        "description": "Page size: 'LETTER' or 'A4'.",
                        "enum": ["LETTER", "A4"],
                        "type": "string",
                    },
                    "theme_color": {
                        "default": "#1e40af",
                        "description": "Primary hex color for headings and table accents (default: '#1e40af').",
                        "type": "string",
                    },
                },
                "required": ["file_path", "markdown_content"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "edit_file": edit_file,
        "name": "edit_file",
        "callable": edit_file,
        "handler": edit_file,
        "description": "Performs find-and-replace or targeted substring edits within an existing file.",
        "parameters": {
            "properties": {
                "encoding": {
                    "default": "utf-8",
                    "description": "File character encoding.",
                    "type": "string",
                },
                "file_path": {
                    "description": "Path to the file to edit.",
                    "type": "string",
                },
                "is_regex": {
                    "default": False,
                    "description": "Whether target_content is a regular expression pattern.",
                    "type": "boolean",
                },
                "replace_all": {
                    "default": False,
                    "description": "Whether to replace all occurrences or only the first.",
                    "type": "boolean",
                },
                "replacement_content": {
                    "description": "Replacement string.",
                    "type": "string",
                },
                "target_content": {
                    "description": "Text or regex pattern to search for.",
                    "type": "string",
                },
            },
            "required": ["file_path", "target_content", "replacement_content"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            edit_file,
            name="edit_file",
            description="Performs find-and-replace or targeted substring edits strictly within files inside the backend/outputs directory.",
            parameters={
                "properties": {
                    "encoding": {
                        "default": "utf-8",
                        "description": "File character encoding.",
                        "type": "string",
                    },
                    "file_path": {
                        "description": "Path to the file to edit inside backend/outputs/.",
                        "type": "string",
                    },
                    "is_regex": {
                        "default": False,
                        "description": "Whether target_content is a regular expression pattern.",
                        "type": "boolean",
                    },
                    "replace_all": {
                        "default": False,
                        "description": "Whether to replace all occurrences or only the first.",
                        "type": "boolean",
                    },
                    "replacement_content": {
                        "description": "Replacement string.",
                        "type": "string",
                    },
                    "target_content": {
                        "description": "Text or regex pattern to search for.",
                        "type": "string",
                    },
                },
                "required": ["file_path", "target_content", "replacement_content"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "delete_rename_file": delete_rename_file,
        "name": "delete_rename_file",
        "callable": delete_rename_file,
        "handler": delete_rename_file,
        "description": "Safely deletes or renames/moves files and directories strictly inside the backend/outputs directory.",
        "parameters": {
            "properties": {
                "action": {
                    "description": "Action to perform: 'delete' or 'rename'.",
                    "enum": ["delete", "rename", "move"],
                    "type": "string",
                },
                "recursive": {
                    "default": False,
                    "description": "Allow recursive deletion of non-empty directories.",
                    "type": "boolean",
                },
                "source_path": {
                    "description": "Source file or directory path inside backend/outputs/.",
                    "type": "string",
                },
                "target_path": {
                    "description": "Target destination path inside backend/outputs/ (required for 'rename').",
                    "type": "string",
                },
            },
            "required": ["action", "source_path"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            delete_rename_file,
            name="delete_rename_file",
            description="Safely deletes or renames/moves files and directories strictly inside the backend/outputs directory.",
            parameters={
                "properties": {
                    "action": {
                        "description": "Action to perform: 'delete' or 'rename'.",
                        "enum": ["delete", "rename", "move"],
                        "type": "string",
                    },
                    "recursive": {
                        "default": False,
                        "description": "Allow recursive deletion of non-empty directories.",
                        "type": "boolean",
                    },
                    "source_path": {
                        "description": "Source file or directory path.",
                        "type": "string",
                    },
                    "target_path": {
                        "description": "Target destination path (required for 'rename').",
                        "type": "string",
                    },
                },
                "required": ["action", "source_path"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "search_files": search_files,
        "name": "search_files",
        "callable": search_files,
        "handler": search_files,
        "description": "Finds files matching glob patterns or searches inside file contents for text/regex.",
        "parameters": {
            "properties": {
                "case_sensitive": {
                    "default": False,
                    "description": "Whether search is case-sensitive.",
                    "type": "boolean",
                },
                "directory_path": {
                    "default": ".",
                    "description": "Base directory to start searching from.",
                    "type": "string",
                },
                "file_pattern": {
                    "default": "*",
                    "description": "Filename glob pattern (e.g. '*.json', '*config*').",
                    "type": "string",
                },
                "is_regex": {
                    "default": False,
                    "description": "Whether query is a regular expression.",
                    "type": "boolean",
                },
                "max_results": {
                    "default": 50,
                    "description": "Maximum number of matches to return.",
                    "type": "integer",
                },
                "query": {
                    "description": "Optional text or regex pattern to search for inside file contents.",
                    "type": "string",
                },
            },
            "type": "object",
        },
        "function": ToolFunctionDict(
            search_files,
            name="search_files",
            description="Finds files matching glob patterns or searches inside file contents for text/regex.",
            parameters={
                "properties": {
                    "case_sensitive": {
                        "default": False,
                        "description": "Whether search is case-sensitive.",
                        "type": "boolean",
                    },
                    "directory_path": {
                        "default": ".",
                        "description": "Base directory to start searching from.",
                        "type": "string",
                    },
                    "file_pattern": {
                        "default": "*",
                        "description": "Filename glob pattern (e.g. '*.json', '*config*').",
                        "type": "string",
                    },
                    "is_regex": {
                        "default": False,
                        "description": "Whether query is a regular expression.",
                        "type": "boolean",
                    },
                    "max_results": {
                        "default": 50,
                        "description": "Maximum number of matches to return.",
                        "type": "integer",
                    },
                    "query": {
                        "description": "Optional text or regex pattern to search for inside file contents.",
                        "type": "string",
                    },
                },
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "get_file_metadata": get_file_metadata,
        "name": "get_file_metadata",
        "callable": get_file_metadata,
        "handler": get_file_metadata,
        "description": "Extracts file metadata including size, mime type, created/modified dates, and SHA-256 hash.",
        "parameters": {
            "properties": {
                "compute_hash": {
                    "default": True,
                    "description": "Whether to compute SHA-256 checksum.",
                    "type": "boolean",
                },
                "file_path": {
                    "description": "Target file or directory path.",
                    "type": "string",
                },
            },
            "required": ["file_path"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            get_file_metadata,
            name="get_file_metadata",
            description="Extracts file metadata including size, mime type, created/modified dates, and SHA-256 hash.",
            parameters={
                "properties": {
                    "compute_hash": {
                        "default": True,
                        "description": "Whether to compute SHA-256 checksum.",
                        "type": "boolean",
                    },
                    "file_path": {
                        "description": "Target file or directory path.",
                        "type": "string",
                    },
                },
                "required": ["file_path"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "web_search": web_search,
        "name": "web_search",
        "callable": web_search,
        "handler": web_search,
        "description": "Performs web searches via public DuckDuckGo endpoints with zero API keys required.",
        "parameters": {
            "properties": {
                "max_results": {
                    "default": 8,
                    "description": "Maximum search results to return.",
                    "type": "integer",
                },
                "query": {
                    "description": "Search query string.",
                    "type": "string",
                },
                "region": {
                    "default": "wt-wt",
                    "description": "Search region code.",
                    "type": "string",
                },
                "safe_search": {
                    "default": "moderate",
                    "description": "Safe search filtering level.",
                    "enum": ["strict", "moderate", "off"],
                    "type": "string",
                },
            },
            "required": ["query"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            web_search,
            name="web_search",
            description="Performs web searches via public DuckDuckGo endpoints with zero API keys required.",
            parameters={
                "properties": {
                    "max_results": {
                        "default": 8,
                        "description": "Maximum search results to return.",
                        "type": "integer",
                    },
                    "query": {
                        "description": "Search query string.",
                        "type": "string",
                    },
                    "region": {
                        "default": "wt-wt",
                        "description": "Search region code.",
                        "type": "string",
                    },
                    "safe_search": {
                        "default": "moderate",
                        "description": "Safe search filtering level.",
                        "enum": ["strict", "moderate", "off"],
                        "type": "string",
                    },
                },
                "required": ["query"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "fetch_webpage": fetch_webpage,
        "name": "fetch_webpage",
        "callable": fetch_webpage,
        "handler": fetch_webpage,
        "description": "Fetches raw HTML and HTTP status/headers from a specified URL with SSRF protection.",
        "parameters": {
            "properties": {
                "headers": {
                    "description": "Optional custom HTTP headers dict.",
                    "type": "object",
                },
                "max_bytes": {
                    "default": 1048576,
                    "description": "Maximum response payload bytes to read.",
                    "type": "integer",
                },
                "timeout": {
                    "default": 15.0,
                    "description": "HTTP request timeout in seconds.",
                    "type": "number",
                },
                "url": {
                    "description": "HTTP or HTTPS URL to fetch.",
                    "type": "string",
                },
            },
            "required": ["url"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            fetch_webpage,
            name="fetch_webpage",
            description="Fetches raw HTML and HTTP status/headers from a specified URL with SSRF protection.",
            parameters={
                "properties": {
                    "headers": {
                        "description": "Optional custom HTTP headers dict.",
                        "type": "object",
                    },
                    "max_bytes": {
                        "default": 1048576,
                        "description": "Maximum response payload bytes to read.",
                        "type": "integer",
                    },
                    "timeout": {
                        "default": 15.0,
                        "description": "HTTP request timeout in seconds.",
                        "type": "number",
                    },
                    "url": {
                        "description": "HTTP or HTTPS URL to fetch.",
                        "type": "string",
                    },
                },
                "required": ["url"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "extract_webpage_content": extract_webpage_content,
        "name": "extract_webpage_content",
        "callable": extract_webpage_content,
        "handler": extract_webpage_content,
        "description": "Extracts clean readable article text, markdown, headings, and links from a webpage.",
        "parameters": {
            "properties": {
                "include_links": {
                    "default": True,
                    "description": "Whether to extract structured hyperlinks.",
                    "type": "boolean",
                },
                "output_format": {
                    "default": "markdown",
                    "description": "Extracted text format: 'markdown' or 'text'.",
                    "enum": ["markdown", "text"],
                    "type": "string",
                },
                "url": {
                    "description": "Target webpage URL to scrape and parse.",
                    "type": "string",
                },
            },
            "required": ["url"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            extract_webpage_content,
            name="extract_webpage_content",
            description="Extracts clean readable article text, markdown, headings, and links from a webpage.",
            parameters={
                "properties": {
                    "include_links": {
                        "default": True,
                        "description": "Whether to extract structured hyperlinks.",
                        "type": "boolean",
                    },
                    "output_format": {
                        "default": "markdown",
                        "description": "Extracted text format: 'markdown' or 'text'.",
                        "enum": ["markdown", "text"],
                        "type": "string",
                    },
                    "url": {
                        "description": "Target webpage URL to scrape and parse.",
                        "type": "string",
                    },
                },
                "required": ["url"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "browse_links": browse_links,
        "name": "browse_links",
        "callable": browse_links,
        "handler": browse_links,
        "description": "Extracts and categorizes all internal and external hyperlinks from a given webpage.",
        "parameters": {
            "properties": {
                "filter_pattern": {
                    "description": "Optional substring or regex to filter link URLs/text.",
                    "type": "string",
                },
                "max_links": {
                    "default": 100,
                    "description": "Maximum number of links to return.",
                    "type": "integer",
                },
                "same_domain_only": {
                    "default": False,
                    "description": "Only return links belonging to the same host domain.",
                    "type": "boolean",
                },
                "url": {
                    "description": "Target webpage URL to inspect.",
                    "type": "string",
                },
            },
            "required": ["url"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            browse_links,
            name="browse_links",
            description="Extracts and categorizes all internal and external hyperlinks from a given webpage.",
            parameters={
                "properties": {
                    "filter_pattern": {
                        "description": "Optional substring or regex to filter link URLs/text.",
                        "type": "string",
                    },
                    "max_links": {
                        "default": 100,
                        "description": "Maximum number of links to return.",
                        "type": "integer",
                    },
                    "same_domain_only": {
                        "default": False,
                        "description": "Only return links belonging to the same host domain.",
                        "type": "boolean",
                    },
                    "url": {
                        "description": "Target webpage URL to inspect.",
                        "type": "string",
                    },
                },
                "required": ["url"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "search_news": search_news,
        "name": "search_news",
        "callable": search_news,
        "handler": search_news,
        "description": "Searches recent news articles and RSS feeds via DuckDuckGo news endpoints.",
        "parameters": {
            "properties": {
                "max_results": {
                    "default": 10,
                    "description": "Maximum news articles to return.",
                    "type": "integer",
                },
                "query": {
                    "description": "News search query keywords.",
                    "type": "string",
                },
                "region": {
                    "default": "wt-wt",
                    "description": "Search region code.",
                    "type": "string",
                },
            },
            "required": ["query"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            search_news,
            name="search_news",
            description="Searches recent news articles and RSS feeds via DuckDuckGo news endpoints.",
            parameters={
                "properties": {
                    "max_results": {
                        "default": 10,
                        "description": "Maximum news articles to return.",
                        "type": "integer",
                    },
                    "query": {
                        "description": "News search query keywords.",
                        "type": "string",
                    },
                    "region": {
                        "default": "wt-wt",
                        "description": "Search region code.",
                        "type": "string",
                    },
                },
                "required": ["query"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "search_images": search_images,
        "name": "search_images",
        "callable": search_images,
        "handler": search_images,
        "description": "Discovers image URLs, thumbnails, and dimensions via DuckDuckGo image search.",
        "parameters": {
            "properties": {
                "max_results": {
                    "default": 10,
                    "description": "Maximum image items to return.",
                    "type": "integer",
                },
                "query": {
                    "description": "Image search query.",
                    "type": "string",
                },
                "safesearch": {
                    "default": "moderate",
                    "description": "SafeSearch level: 'off', 'moderate', or 'strict'.",
                    "enum": ["off", "moderate", "strict"],
                    "type": "string",
                },
            },
            "required": ["query"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            search_images,
            name="search_images",
            description="Discovers image URLs, thumbnails, and dimensions via DuckDuckGo image search.",
            parameters={
                "properties": {
                    "max_results": {
                        "default": 10,
                        "description": "Maximum image items to return.",
                        "type": "integer",
                    },
                    "query": {
                        "description": "Image search query.",
                        "type": "string",
                    },
                    "safesearch": {
                        "default": "moderate",
                        "description": "SafeSearch level: 'off', 'moderate', or 'strict'.",
                        "enum": ["off", "moderate", "strict"],
                        "type": "string",
                    },
                },
                "required": ["query"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "query_apis": query_apis,
        "name": "query_apis",
        "callable": query_apis,
        "handler": query_apis,
        "description": "Dispatches arbitrary HTTP REST API requests (GET, POST, PUT, DELETE, PATCH) with JSON.",
        "parameters": {
            "properties": {
                "headers": {
                    "description": "Optional HTTP request headers.",
                    "type": "object",
                },
                "json_data": {
                    "description": "Optional JSON serializable body payload.",
                },
                "method": {
                    "default": "GET",
                    "description": "HTTP method to execute.",
                    "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
                    "type": "string",
                },
                "params": {
                    "description": "Optional query parameters.",
                    "type": "object",
                },
                "timeout": {
                    "default": 30.0,
                    "description": "Request timeout in seconds.",
                    "type": "number",
                },
                "url": {
                    "description": "Full REST API endpoint URL.",
                    "type": "string",
                },
            },
            "required": ["url"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            query_apis,
            name="query_apis",
            description="Dispatches arbitrary HTTP REST API requests (GET, POST, PUT, DELETE, PATCH) with JSON.",
            parameters={
                "properties": {
                    "headers": {
                        "description": "Optional HTTP request headers.",
                        "type": "object",
                    },
                    "json_data": {
                        "description": "Optional JSON serializable body payload.",
                    },
                    "method": {
                        "default": "GET",
                        "description": "HTTP method to execute.",
                        "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
                        "type": "string",
                    },
                    "params": {
                        "description": "Optional query parameters.",
                        "type": "object",
                    },
                    "timeout": {
                        "default": 30.0,
                        "description": "Request timeout in seconds.",
                        "type": "number",
                    },
                    "url": {
                        "description": "Full REST API endpoint URL.",
                        "type": "string",
                    },
                },
                "required": ["url"],
                "type": "object",
            },
        ),
    },
    {
        "type": "function",
        "system_notification": system_notification,
        "name": "system_notification",
        "callable": system_notification,
        "handler": system_notification,
        "description": "Displays a real-time notification alert toast in the frontend interface for the operator, and records it in the workbench notification center.",
        "parameters": {
            "properties": {
                "message": {
                    "description": "Notification body message text to display to the user.",
                    "type": "string",
                },
                "title": {
                    "default": "Agent Notification",
                    "description": "Optional title header for the notification alert.",
                    "type": "string",
                },
                "type": {
                    "default": "info",
                    "description": "Notification visual style: 'info', 'success', 'warning', or 'error'.",
                    "type": "string",
                },
                "level": {
                    "description": "Optional alias for type ('info', 'success', 'warning', 'error').",
                    "type": "string",
                },
            },
            "required": ["message"],
            "type": "object",
        },
        "function": ToolFunctionDict(
            system_notification,
            name="system_notification",
            description="Displays a real-time notification alert toast in the frontend interface for the operator, and records it in the workbench notification center.",
            parameters={
                "properties": {
                    "message": {
                        "description": "Notification body message text to display to the user.",
                        "type": "string",
                    },
                    "title": {
                        "default": "Agent Notification",
                        "description": "Optional title header for the notification alert.",
                        "type": "string",
                    },
                    "type": {
                        "default": "info",
                        "description": "Notification visual style: 'info', 'success', 'warning', or 'error'.",
                        "type": "string",
                    },
                    "level": {
                        "description": "Optional alias for type ('info', 'success', 'warning', 'error').",
                        "type": "string",
                    },
                },
                "required": ["message"],
                "type": "object",
            },
        ),
    },
]

# Static list of dicts where key is tool name and value is the callable function
TOOLS_NAME: list[dict[str, Callable[..., dict[str, Any]]]] = [
    {"read_file": read_file},
    {"create_file": create_file},
    {"create_pdf_from_markdown": create_pdf_from_markdown},
    {"edit_file": edit_file},
    {"delete_rename_file": delete_rename_file},
    {"search_files": search_files},
    {"get_file_metadata": get_file_metadata},
    {"web_search": web_search},
    {"fetch_webpage": fetch_webpage},
    {"extract_webpage_content": extract_webpage_content},
    {"browse_links": browse_links},
    {"search_news": search_news},
    {"search_images": search_images},
    {"query_apis": query_apis},
    {"system_notification": system_notification},
]

# Aliases for flexible runtime consumption
tools_name = TOOLS_NAME
tools = TOOLS

# Static list of all tool names
TOOL_NAMES: list[str] = [t["name"] for t in TOOLS]

# Dictionary mapping tool name to description
TOOL_DESCRIPTIONS: dict[str, str] = {t["name"]: t["description"] for t in TOOLS}

# Dictionary mapping tool name string directly to its callable function
TOOLS_MAP: dict[str, Callable[..., dict[str, Any]]] = {
    t["name"]: t["callable"] for t in TOOLS
}
# Direct alias for create_file
TOOLS_MAP["create_file"] = create_file


# Standard OpenAI / llama-server tool definitions list (pure JSON serializable)
OPENAI_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["parameters"],
        },
    }
    for t in TOOLS
]


def get_tool(name: str) -> Callable[..., dict[str, Any]] | None:
    """Retrieves the executable callable function for a named tool."""
    if name in ("create_file", "write_create_file"):
        return create_file
    return TOOLS_MAP.get(name)


def run_tool(name: str, **kwargs: Any) -> dict[str, Any]:
    """Executes a tool by name with the given keyword arguments."""
    handler = get_tool(name)
    if not handler:
        return {
            "success": False,
            "error": f"Tool '{name}' is not registered in TOOLS_MAP.",
        }
    return handler(**kwargs)


__all__ = [
    "TOOLS",
    "TOOLS_NAME",
    "tools_name",
    "tools",
    "TOOL_NAMES",
    "TOOL_DESCRIPTIONS",
    "TOOLS_MAP",
    "OPENAI_TOOLS",
    "ToolFunctionDict",
    "get_tool",
    "run_tool",
    "read_file",
    "create_file",
    "write_create_file",
    "create_pdf_from_markdown",
    "edit_file",
    "delete_rename_file",
    "search_files",
    "get_file_metadata",
    "web_search",
    "fetch_webpage",
    "extract_webpage_content",
    "browse_links",
    "search_news",
    "search_images",
    "query_apis",
    "system_notification",
    "get_upload_dir",
    "get_outputs_dir",
    "resolve_safe_path",
    "resolve_output_path",
    # Legacy imports for backward compatibility
    "list_directory",
    "parse_pdf",
    "read_write_csv_excel_json_xml",
    "compress_extract_zip",
    "download_files",
    "python_execution",
]
