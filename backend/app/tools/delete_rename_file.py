"""Tool: Delete / Rename File
Safely deletes or renames/moves files and directories.
"""

import os
from pathlib import Path
import shutil
from typing import Any


from app.tools.file_security import get_upload_dir, resolve_safe_path


def delete_rename_file(
    action: str,
    source_path: str,
    target_path: str | None = None,
    recursive: bool = False,
) -> dict[str, Any]:
    """Deletes or renames/moves a file or directory inside the uploads directory.

    Args:
        action: Either 'delete' or 'rename' (or 'move').
        source_path: Path to the target file or directory inside uploads.
        target_path: Destination path inside uploads (required for 'rename'/'move').
        recursive: If True, allow recursive deletion of non-empty directories.

    Returns:
        dict: Result containing 'success', 'action', and paths.
    """
    try:
        src = resolve_safe_path(source_path)
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": str(err),
            "source_path": str(source_path),
        }

    act = action.strip().lower()
    upload_root = get_upload_dir()

    if src == upload_root:
        return {
            "success": False,
            "error": "Operation prohibited: Cannot delete or move the root uploads directory.",
            "source_path": str(src),
        }

    if not src.exists():
        return {
            "success": False,
            "error": f"Source path does not exist: {source_path}",
            "source_path": str(src),
        }

    try:
        if act == "delete":
            if src.is_file() or src.is_symlink():
                src.unlink()
            elif src.is_dir():
                if recursive:
                    shutil.rmtree(src)
                else:
                    src.rmdir()  # Fails safely if directory is not empty
            return {
                "success": True,
                "action": "delete",
                "source_path": str(src),
            }

        elif act in ("rename", "move"):
            if not target_path:
                return {
                    "success": False,
                    "error": "target_path is required for 'rename' action.",
                    "source_path": str(src),
                }

            try:
                dst = resolve_safe_path(target_path)
            except (PermissionError, ValueError) as err:
                return {
                    "success": False,
                    "error": str(err),
                    "source_path": str(src),
                }

            if dst == upload_root:
                return {
                    "success": False,
                    "error": "Cannot overwrite or rename into the root uploads directory itself.",
                    "source_path": str(src),
                }

            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))

            return {
                "success": True,
                "action": "rename",
                "source_path": str(src),
                "target_path": str(dst),
            }

        else:
            return {
                "success": False,
                "error": f"Unsupported action '{action}'. Use 'delete' or 'rename'.",
            }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed {act} operation: {exc}",
            "source_path": str(src),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return delete_rename_file(**kwargs)
