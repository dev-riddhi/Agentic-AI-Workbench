"""Tool: Create File
Creates files strictly inside the backend/outputs directory, using specialized format helpers
when available (PDF, Excel .xlsx, CSV .csv, Word .docx, PowerPoint .pptx), or creating a Markdown
(.md) file instead when no specialized helper exists for the requested format.
"""

from pathlib import Path
from typing import Any

from app.tools.file.file_security import get_outputs_dir, resolve_output_path
from app.tools.utils import FILE_CREATION_HELPERS


# Standard normalized file extensions for known types
CANONICAL_EXTENSIONS: dict[str, str] = {
    "pdf": "pdf",
    "xlsx": "xlsx",
    "xlsl": "xlsx",
    "xls": "xlsx",
    "excel": "xlsx",
    "csv": "csv",
    "tsv": "csv",
    "docx": "docx",
    "docs": "docx",
    "doc": "docx",
    "word": "docx",
    "pptx": "pptx",
    "ppt": "pptx",
    "powerpoint": "pptx",
    "presentation": "pptx",
    "md": "md",
    "markdown": "md",
}


def create_file(
    file_path: str,
    content: str = "",
    file_type: str | None = None,
    title: str | None = None,
    mode: str = "w",
    overwrite: bool = True,
    **kwargs: Any,
) -> dict[str, Any]:
    """Creates a file strictly inside the backend/outputs folder and registers it in agent_outputs.

    Detects what type of file the user/agent wants to create via the `file_type` parameter
    or filename extension.
    - If a specialized creation helper is available (PDF, Excel, CSV, Word, PowerPoint),
      creates that native file format.
    - If no specialized helper is available for that format, creates a Markdown (.md) file instead.

    Args:
        file_path: Destination filename or relative path inside backend/outputs.
        content: Text, markdown, or tabular content to write into the file.
        file_type: Type of file to create (e.g. 'xlsx', 'xlsl', 'csv', 'docx', 'docs', 'pptx', 'pdf', 'md').
        title: Optional document title for generated deliverables.
        mode: Write mode: 'w' for overwrite/create, 'a' for append (default: 'w').
        overwrite: If False and mode is 'w' and file exists, abort without modifying.
        **kwargs: Additional parameters passed to format-specific helpers (e.g. encoding='utf-8').

    Returns:
        dict: Result containing 'success', 'file_path', 'filename', 'output_type', etc.
    """
    if not file_path or not str(file_path).strip():
        return {
            "success": False,
            "error": "File path cannot be empty.",
            "file_path": str(file_path),
        }

    # Extract encoding safely from kwargs if passed
    encoding = kwargs.pop("encoding", "utf-8")

    # Strictly resolve target path inside backend/outputs
    try:
        target_path = resolve_output_path(file_path)
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": str(err),
            "file_path": str(file_path),
        }

    # Detect what file type user wants to create
    detected_format = (
        file_type.lower().strip().lstrip(".")
        if file_type
        else kwargs.get("format", "").lower().strip().lstrip(".")
    )
    if not detected_format:
        detected_format = target_path.suffix.lower().lstrip(".")
    if not detected_format:
        detected_format = "md"

    # Map to canonical extension if known
    canonical_type = CANONICAL_EXTENSIONS.get(detected_format, detected_format)

    # Support content aliases
    actual_content = content if content else kwargs.get("markdown_content") or kwargs.get("text") or ""

    # Check if a specialized file creation helper is available
    helper_fn = FILE_CREATION_HELPERS.get(canonical_type) or FILE_CREATION_HELPERS.get(detected_format)

    if helper_fn is not None:
        # Specialized helper is available (e.g. PDF, Excel, CSV, Word, PPTX)
        desired_ext = f".{canonical_type}"
        target_filename = target_path.stem + desired_ext

        try:
            result = helper_fn(
                file_path=target_filename,
                content=actual_content,
                title=title,
                overwrite=overwrite,
                encoding=encoding,
                **kwargs,
            )
            if isinstance(result, dict):
                result["requested_format"] = detected_format
                result["created_format"] = canonical_type
            return result
        except Exception as helper_err:
            return {
                "success": False,
                "error": f"Failed to generate {canonical_type.upper()} file using helper: {helper_err}",
                "file_path": str(target_path),
                "requested_format": detected_format,
            }

    # No specialized helper is available -> create .md file instead
    target_path = target_path.with_suffix(".md")

    if not overwrite and mode == "w" and target_path.exists():
        return {
            "success": False,
            "error": f"File already exists and overwrite is False: {target_path.name}",
            "file_path": str(target_path),
            "requested_format": detected_format,
            "created_format": "md",
        }

    try:
        created = not target_path.exists()
        target_path.parent.mkdir(parents=True, exist_ok=True)

        write_mode = "a" if mode == "a" else "w"
        with open(target_path, write_mode, encoding=encoding, errors="replace") as f:
            bytes_written = f.write(actual_content)

        file_size = target_path.stat().st_size
        doc_title = title or target_path.stem.replace("_", " ").title()

        # Update agent_outputs db record
        try:
            from app.runtime.agent_runtime import record_tool_generated_output
            record_tool_generated_output(
                file_path=str(target_path),
                title=doc_title,
                output_type="md",
                content_preview=actual_content[:500] if actual_content else None,
            )
        except Exception:
            pass

        format_msg = (
            f"Created '{target_path.name}' (.md) in outputs directory. "
            f"Note: No specialized helper is available for '{detected_format}'; created as Markdown (.md) instead."
            if detected_format != "md"
            else f"Created markdown file '{target_path.name}' in outputs directory."
        )

        return {
            "success": True,
            "file_path": str(target_path),
            "filename": target_path.name,
            "file_size": file_size,
            "title": doc_title,
            "output_type": "md",
            "requested_format": detected_format,
            "created_format": "md",
            "bytes_written": bytes_written,
            "created": created,
            "mode": write_mode,
            "message": format_msg,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to write markdown file: {exc}",
            "file_path": str(target_path),
            "requested_format": detected_format,
            "created_format": "md",
        }


# Aliases for backwards compatibility with tests and callers
write_create_file = create_file


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return create_file(**kwargs)
