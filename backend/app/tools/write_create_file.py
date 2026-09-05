"""Tool: Write / Create File
Creates a new file or overwrites/appends to an existing file, creating parent directories if needed.
"""

import os
from pathlib import Path
from typing import Any


def write_create_file(
    file_path: str,
    content: str,
    mode: str = "w",
    encoding: str = "utf-8",
    overwrite: bool = True,
) -> dict[str, Any]:
    """Writes content to a file, creating directories automatically.

    Args:
        file_path: Absolute or relative path to the destination file.
        content: Text content to write.
        mode: Write mode: 'w' for overwrite/create, 'a' for append (default: 'w').
        encoding: File character encoding (default: 'utf-8').
        overwrite: If False and mode is 'w' and file exists, abort without modifying.

    Returns:
        dict: Result containing 'success', 'file_path', 'bytes_written', and 'created'.
    """
    path = Path(file_path).resolve()

    if not overwrite and mode == "w" and path.exists():
        return {
            "success": False,
            "error": f"File already exists and overwrite is False: {file_path}",
            "file_path": str(path),
        }

    try:
        created = not path.exists()
        path.parent.mkdir(parents=True, exist_ok=True)

        write_mode = "a" if mode == "a" else "w"
        with open(path, write_mode, encoding=encoding, errors="replace") as f:
            bytes_written = f.write(content)

        return {
            "success": True,
            "file_path": str(path),
            "bytes_written": bytes_written,
            "created": created,
            "mode": write_mode,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to write file: {exc}",
            "file_path": str(path),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return write_create_file(**kwargs)
