"""Tool: Read File
Reads content from a specified file with optional line-range or byte-size slicing.
"""

from pathlib import Path
from typing import Any


def read_file(
    file_path: str,
    encoding: str = "utf-8",
    start_line: int | None = None,
    end_line: int | None = None,
    max_bytes: int | None = None,
) -> dict[str, Any]:
    """Reads content from a file.

    Args:
        file_path: Absolute or relative path to the file.
        encoding: File character encoding (default: utf-8).
        start_line: Optional 1-based start line index (inclusive).
        end_line: Optional 1-based end line index (inclusive).
        max_bytes: Optional limit on the number of bytes to read.

    Returns:
        dict: Result containing 'content', 'total_lines', 'size_bytes', and 'truncated'.
    """
    path = Path(file_path).resolve()
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

    try:
        size_bytes = path.stat().st_size
        with open(path, "r", encoding=encoding, errors="replace") as f:
            if max_bytes is not None and max_bytes > 0:
                raw_content = f.read(max_bytes)
                truncated = size_bytes > max_bytes
                lines = raw_content.splitlines()
                return {
                    "success": True,
                    "file_path": str(path),
                    "content": raw_content,
                    "total_lines": len(lines),
                    "size_bytes": size_bytes,
                    "truncated": truncated,
                }

            lines = f.readlines()
            total_lines = len(lines)

            # 1-indexed slicing
            s_idx = max(0, start_line - 1) if start_line is not None and start_line > 0 else 0
            e_idx = end_line if end_line is not None and end_line > 0 else total_lines

            sliced_lines = lines[s_idx:e_idx]
            content = "".join(sliced_lines)
            truncated = s_idx > 0 or e_idx < total_lines

            return {
                "success": True,
                "file_path": str(path),
                "content": content,
                "start_line": s_idx + 1 if total_lines > 0 else 1,
                "end_line": min(e_idx, total_lines),
                "total_lines": total_lines,
                "size_bytes": size_bytes,
                "truncated": truncated,
            }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to read file: {exc}",
            "file_path": str(path),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return read_file(**kwargs)
