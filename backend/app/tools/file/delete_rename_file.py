"""Tool: Delete / Rename File
Safely deletes or renames/moves files and directories strictly inside the backend/outputs directory.
"""

from pathlib import Path
import shutil
from typing import Any

from app.tools.file.file_security import get_outputs_dir, resolve_output_path


def delete_rename_file(
    action: str,
    source_path: str,
    target_path: str | None = None,
    recursive: bool = False,
) -> dict[str, Any]:
    """Deletes or renames/moves a file or directory strictly inside the outputs directory.

    Args:
        action: Either 'delete' or 'rename' (or 'move').
        source_path: Path to the target file or directory inside backend/outputs.
        target_path: Destination path inside backend/outputs (required for 'rename'/'move').
        recursive: If True, allow recursive deletion of non-empty directories.

    Returns:
        dict: Result containing 'success', 'action', and paths.
    """
    try:
        src = resolve_output_path(source_path)
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": f"Access denied: file operations are strictly restricted to the outputs folder. {err}",
            "source_path": str(source_path),
        }

    act = action.strip().lower()
    outputs_root = get_outputs_dir()

    if src == outputs_root:
        return {
            "success": False,
            "error": "Operation prohibited: Cannot delete or move the root outputs directory.",
            "source_path": str(src),
        }

    if not src.exists():
        return {
            "success": False,
            "error": f"Source path does not exist in outputs folder: {source_path}",
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
                dst = resolve_output_path(target_path)
            except (PermissionError, ValueError) as err:
                return {
                    "success": False,
                    "error": f"Access denied: target_path must be inside the outputs folder. {err}",
                    "source_path": str(src),
                }

            if dst == outputs_root:
                return {
                    "success": False,
                    "error": "Cannot overwrite or rename into the root outputs directory itself.",
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
