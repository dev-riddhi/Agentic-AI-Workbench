"""Tool: Get File Metadata
Extracts file/directory metadata: size, timestamps, mime type, permissions, and SHA-256 hash.
"""

from datetime import datetime, timezone
import hashlib
import mimetypes
import os
from pathlib import Path
from typing import Any


from app.tools.file_security import resolve_safe_path


def get_file_metadata(
    file_path: str,
    compute_checksum: bool = True,
) -> dict[str, Any]:
    """Retrieves detailed metadata for a file or directory inside uploads.

    Args:
        file_path: Path to the target file or directory inside uploads.
        compute_checksum: If True and target is a file (< 200MB), computes SHA-256 hash.

    Returns:
        dict: Detailed metadata attributes.
    """
    try:
        path = resolve_safe_path(file_path)
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": str(err),
            "file_path": str(file_path),
        }

    if not path.exists():
        return {
            "success": False,
            "error": f"Path does not exist: {file_path}",
            "file_path": str(path),
        }

    try:
        stat = path.stat()
        is_file = path.is_file()
        is_dir = path.is_dir()
        is_symlink = path.is_symlink()

        mime_type, _ = mimetypes.guess_type(str(path))

        sha256_hash = None
        if is_file and compute_checksum and stat.st_size <= 200 * 1024 * 1024:
            hasher = hashlib.sha256()
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    hasher.update(chunk)
            sha256_hash = hasher.hexdigest()

        return {
            "success": True,
            "name": path.name,
            "file_path": str(path),
            "is_file": is_file,
            "is_dir": is_dir,
            "is_symlink": is_symlink,
            "size_bytes": stat.st_size,
            "size_formatted": _format_size(stat.st_size),
            "extension": path.suffix.lower() if is_file else None,
            "mime_type": mime_type or ("inode/directory" if is_dir else "application/octet-stream"),
            "created_at": datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc).isoformat(),
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "sha256": sha256_hash,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed retrieving metadata: {exc}",
            "file_path": str(path),
        }


def _format_size(size_bytes: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return get_file_metadata(**kwargs)
