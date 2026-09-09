"""Tool: List Directory
Lists directory contents with file metadata, sizes, timestamps, and optional recursion.
"""

from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Any


from app.tools.file_security import resolve_safe_path


def list_directory(
    directory_path: str = ".",
    recursive: bool = False,
    include_hidden: bool = False,
    max_depth: int = 1,
    pattern: str | None = None,
) -> dict[str, Any]:
    """Lists the contents of a directory inside the uploads directory.

    Args:
        directory_path: Path to the directory inside uploads (default: '.' for uploads root).
        recursive: If True, recursively list subdirectories up to max_depth.
        include_hidden: If True, include hidden files starting with '.'.
        max_depth: Maximum directory recursion depth (default: 1).
        pattern: Optional fnmatch pattern (e.g. '*.py', '*.json').

    Returns:
        dict: Result containing directory path, items list, and total count.
    """
    try:
        root = resolve_safe_path(directory_path, default_to_root=True)
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": str(err),
            "directory": str(directory_path),
        }

    if not root.exists():
        return {
            "success": False,
            "error": f"Directory does not exist: {directory_path}",
            "directory": str(root),
        }
    if not root.is_dir():
        return {
            "success": False,
            "error": f"Path is not a directory: {directory_path}",
            "directory": str(root),
        }

    items: list[dict[str, Any]] = []

    def scan(current_dir: Path, current_depth: int) -> None:
        try:
            entries = sorted(current_dir.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
            for entry in entries:
                if not include_hidden and entry.name.startswith("."):
                    continue

                if pattern and not entry.match(pattern):
                    if not entry.is_dir():
                        continue

                is_dir = entry.is_dir()
                rel_path = str(entry.relative_to(root))
                stat = entry.stat()

                item_info: dict[str, Any] = {
                    "name": entry.name,
                    "relative_path": rel_path,
                    "is_dir": is_dir,
                    "size_bytes": stat.st_size if not is_dir else None,
                    "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                }
                items.append(item_info)

                if is_dir and recursive and current_depth < max_depth:
                    scan(entry, current_depth + 1)
        except PermissionError:
            items.append({
                "name": current_dir.name,
                "relative_path": str(current_dir.relative_to(root)),
                "error": "Permission denied",
            })

    try:
        scan(root, 1)
        return {
            "success": True,
            "directory": str(root),
            "total_count": len(items),
            "items": items,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to list directory: {exc}",
            "directory": str(root),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return list_directory(**kwargs)
