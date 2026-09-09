"""Tool: Read File
Reads content from any permitted folder (including uploads/ and outputs/).
Automatically detects document types:
- PDF documents (.pdf)
- Excel spreadsheets (.xlsx, .xls)
- CSV / TSV tabular files (.csv, .tsv)
- Word documents (.docx)
- PowerPoint presentations (.pptx)
- Text and source code files (.txt, .md, .py, .json, etc.) with optional line-range or byte-size slicing.
"""

from pathlib import Path
from typing import Any

from app.tools.document_extractors import auto_detect_and_extract
from app.tools.file.file_security import get_outputs_dir, get_upload_dir


def read_file(
    file_path: str,
    encoding: str = "utf-8",
    start_line: int | None = None,
    end_line: int | None = None,
    max_bytes: int | None = None,
    max_rows: int | None = None,
    max_pages: int | None = None,
    sheet_name: str | None = None,
    delimiter: str | None = None,
) -> dict[str, Any]:
    """Reads and automatically extracts content from files in uploads or outputs directories.

    Supports rich document formats (PDF, Excel, CSV, Word, PowerPoint) as well as plain text/code.

    Args:
        file_path: Path or filename inside uploads/ or outputs/ (e.g. 'data.xlsx', 'report.pdf', 'summary.md').
        encoding: Character encoding for text files (default: 'utf-8').
        start_line: Optional 1-based start line index for text files.
        end_line: Optional 1-based end line index for text files.
        max_bytes: Optional limit on the number of bytes to read for text files.
        max_rows: Optional limit on rows to extract from Excel or CSV files.
        max_pages: Optional limit on pages to extract from PDF files.
        sheet_name: Optional specific sheet name to extract from Excel workbooks.
        delimiter: Optional custom delimiter for CSV/TSV files (e.g. ',', '\t', ';').

    Returns:
        dict: Result containing 'success', 'file_path', 'format', 'content', 'size_bytes', and optional metadata.
    """
    if not file_path or not str(file_path).strip():
        return {
            "success": False,
            "error": "File path cannot be empty.",
            "file_path": str(file_path),
        }

    uploads_dir = get_upload_dir()
    outputs_dir = get_outputs_dir()

    raw = str(file_path).strip().replace("\\", "/")
    while raw.startswith("./"):
        raw = raw[2:]

    # Normalize relative path
    if raw.startswith("outputs/"):
        rel_out = raw[len("outputs/") :]
        path = (outputs_dir / rel_out).resolve()
    elif raw.startswith("uploads/outputs/"):
        rel_out = raw[len("uploads/outputs/") :]
        path = (outputs_dir / rel_out).resolve()
    elif raw.startswith("uploads/"):
        rel = raw[len("uploads/") :]
        path = (uploads_dir / rel).resolve()
    else:
        p = Path(raw)
        path = (uploads_dir / p).resolve()

    # If not found directly, check alternative locations (outputs, .md extension fallback, etc.)
    if not path.exists():
        raw_p = Path(raw)
        # Check in outputs directory
        cand_out = (outputs_dir / raw_p.name).resolve()
        if cand_out.exists():
            path = cand_out
        elif (outputs_dir / raw_p).resolve().exists():
            path = (outputs_dir / raw_p).resolve()
        elif cand_out.with_suffix(".md").exists():
            path = cand_out.with_suffix(".md")
        elif (uploads_dir / raw_p).resolve().exists():
            path = (uploads_dir / raw_p).resolve()
        elif (uploads_dir / raw_p).with_suffix(".md").exists():
            path = (uploads_dir / raw_p).with_suffix(".md")

    if not path.exists():
        return {
            "success": False,
            "error": f"File does not exist: {file_path}",
            "file_path": str(path),
        }
    if not path.is_file():
        return {
            "success": False,
            "error": f"Path is not a file: {file_path}",
            "file_path": str(path),
        }

    size_bytes = path.stat().st_size

    # Handle optional text slicing parameters
    has_text_params = (
        start_line is not None
        or end_line is not None
        or max_bytes is not None
    )

    # 1. First attempt structured rich document extraction (PDF, Excel, CSV, Word, PPTX)
    structured_result = auto_detect_and_extract(
        path,
        max_rows=max_rows,
        max_pages=max_pages,
        sheet_name=sheet_name,
        delimiter=delimiter,
        encoding=encoding,
    )

    if structured_result is not None:
        if "error" not in structured_result:
            structured_result["success"] = True
            structured_result["file_path"] = str(path)
            structured_result["filename"] = path.name
            structured_result["size_bytes"] = size_bytes
            content_text = structured_result.get("content", "")
            if has_text_params and isinstance(content_text, str):
                sliced = _slice_text(content_text, start_line, end_line, max_bytes)
                structured_result.update(sliced)
            return structured_result
        # If extractor had an error on a rich document, return that error
        return {
            "success": False,
            "error": structured_result.get("error", "Failed to extract document content."),
            "file_path": str(path),
            "format": structured_result.get("format", "unknown"),
        }

    # 2. Fallback to standard text reading with line/byte slicing
    try:
        with open(path, "r", encoding=encoding, errors="replace") as f:
            content = f.read()

        slice_info = _slice_text(content, start_line, end_line, max_bytes)
        return {
            "success": True,
            "file_path": str(path),
            "filename": path.name,
            "format": "text",
            "size_bytes": size_bytes,
            **slice_info,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to read file: {exc}",
            "file_path": str(path),
        }


def _slice_text(
    content: str,
    start_line: int | None,
    end_line: int | None,
    max_bytes: int | None,
) -> dict[str, Any]:
    """Helper to apply line and byte slicing to text content."""
    lines = content.splitlines(keepends=True)
    total_lines = len(lines)

    # Apply 1-based line slicing
    s = (start_line - 1) if (start_line is not None and start_line > 0) else 0
    e = end_line if (end_line is not None and end_line > 0) else total_lines
    selected_lines = lines[s:e]
    result_text = "".join(selected_lines)

    # Apply byte limit
    truncated = False
    if max_bytes is not None and len(result_text.encode("utf-8")) > max_bytes:
        encoded = result_text.encode("utf-8")[:max_bytes]
        result_text = encoded.decode("utf-8", errors="ignore")
        truncated = True

    return {
        "content": result_text,
        "total_lines": total_lines,
        "start_line": s + 1 if start_line is not None else 1,
        "end_line": min(e, total_lines) if end_line is not None else total_lines,
        "lines_returned": len(selected_lines),
        "truncated": truncated,
    }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return read_file(**kwargs)
