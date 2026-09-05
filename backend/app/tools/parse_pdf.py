"""Tool: Parse PDF
Extracts text, metadata, page counts, and specific page ranges from PDF files using pypdf.
"""

from pathlib import Path
from typing import Any


def parse_pdf(
    file_path: str,
    pages: list[int] | None = None,
    max_pages: int | None = None,
    extract_metadata: bool = True,
) -> dict[str, Any]:
    """Extracts text content and metadata from a PDF file.

    Args:
        file_path: Absolute or relative path to the PDF file.
        pages: Optional list of specific 1-based page numbers to extract (e.g. [1, 2, 5]).
        max_pages: Optional maximum number of pages to parse.
        extract_metadata: Whether to extract document title, author, and creation metadata.

    Returns:
        dict: Result containing extracted text, page count, and metadata.
    """
    path = Path(file_path).resolve()
    if not path.exists():
        return {
            "success": False,
            "error": f"PDF file does not exist: {file_path}",
            "file_path": str(path),
        }
    if not path.is_file():
        return {
            "success": False,
            "error": f"Path is not a file: {file_path}",
            "file_path": str(path),
        }

    try:
        from pypdf import PdfReader
    except ImportError:
        return {
            "success": False,
            "error": "pypdf package is not installed. Please run 'uv add pypdf'.",
            "file_path": str(path),
        }

    try:
        reader = PdfReader(str(path))
        total_pages = len(reader.pages)

        # Determine which pages to read (0-based)
        if pages:
            target_indices = [p - 1 for p in pages if 1 <= p <= total_pages]
        else:
            limit = max_pages if max_pages and max_pages < total_pages else total_pages
            target_indices = list(range(limit))

        extracted_pages: list[dict[str, Any]] = []
        full_text_chunks: list[str] = []

        for idx in target_indices:
            page = reader.pages[idx]
            page_text = page.extract_text() or ""
            extracted_pages.append({
                "page_number": idx + 1,
                "text": page_text,
                "char_count": len(page_text),
            })
            full_text_chunks.append(f"--- Page {idx + 1} ---\n{page_text}")

        metadata_dict = {}
        if extract_metadata and reader.metadata:
            for k, v in reader.metadata.items():
                clean_key = k.lstrip("/")
                metadata_dict[clean_key] = str(v) if v is not None else ""

        return {
            "success": True,
            "file_path": str(path),
            "total_pages": total_pages,
            "pages_parsed": len(extracted_pages),
            "metadata": metadata_dict,
            "text": "\n\n".join(full_text_chunks),
            "pages": extracted_pages,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed parsing PDF: {exc}",
            "file_path": str(path),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return parse_pdf(**kwargs)
