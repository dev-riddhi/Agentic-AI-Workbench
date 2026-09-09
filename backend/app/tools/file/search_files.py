"""Tool: Search Files
Finds files by filename pattern (glob) or searches for text patterns within file contents.
"""

from pathlib import Path
import re
from typing import Any


from app.tools.file.file_security import resolve_safe_path


def search_files(
    directory_path: str = ".",
    query: str | None = None,
    file_pattern: str = "*",
    is_regex: bool = False,
    case_sensitive: bool = False,
    max_results: int = 50,
) -> dict[str, Any]:
    """Searches for files matching a pattern and/or containing specific content inside uploads.

    Args:
        directory_path: Base directory inside uploads to search from (default: '.' for uploads root).
        query: Optional string/regex to search for inside file contents.
        file_pattern: Filename glob pattern (e.g. '*.py', '*config*').
        is_regex: If True, treat query as a regular expression.
        case_sensitive: Whether the content search is case-sensitive.
        max_results: Maximum number of matches to return.

    Returns:
        dict: Result containing matching files or line matches.
    """
    try:
        root = resolve_safe_path(directory_path, default_to_root=True)
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": str(err),
            "directory": str(directory_path),
        }

    if not root.exists() or not root.is_dir():
        return {
            "success": False,
            "error": f"Invalid search directory: {directory_path}",
            "directory": str(root),
        }

    results: list[dict[str, Any]] = []

    try:
        flags = 0 if case_sensitive else re.IGNORECASE
        compiled_re = None
        if query and is_regex:
            compiled_re = re.compile(query, flags)

        for path in root.rglob(file_pattern):
            if len(results) >= max_results:
                break
            if not path.is_file():
                continue

            # If no content query provided, match by filename pattern
            if not query:
                results.append({
                    "file_path": str(path),
                    "relative_path": str(path.relative_to(root)),
                    "size_bytes": path.stat().st_size,
                })
                continue

            # Content query: search inside file
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, start=1):
                        matched = False
                        if compiled_re:
                            matched = bool(compiled_re.search(line))
                        elif case_sensitive:
                            matched = query in line
                        else:
                            matched = query.lower() in line.lower()

                        if matched:
                            results.append({
                                "file_path": str(path),
                                "relative_path": str(path.relative_to(root)),
                                "line_number": line_num,
                                "line_content": line.strip()[:200],
                            })
                            if len(results) >= max_results:
                                break
            except (PermissionError, OSError):
                continue

        return {
            "success": True,
            "directory": str(root),
            "total_matches": len(results),
            "query": query,
            "file_pattern": file_pattern,
            "results": results,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Search failed: {exc}",
            "directory": str(root),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return search_files(**kwargs)
