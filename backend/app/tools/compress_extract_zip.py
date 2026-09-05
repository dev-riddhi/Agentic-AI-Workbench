"""Tool: Compress / Extract ZIP
Creates zip archives or extracts archives with Zip Slip path-traversal prevention.
"""

import os
from pathlib import Path
from typing import Any
import zipfile


def compress_extract_zip(
    action: str,
    zip_path: str,
    source_paths: list[str] | None = None,
    destination_path: str | None = None,
) -> dict[str, Any]:
    """Compresses files/folders into a ZIP or extracts files from a ZIP archive.

    Args:
        action: 'compress', 'extract', or 'list'.
        zip_path: Path to the target or source .zip file.
        source_paths: List of file/folder paths to include when compressing.
        destination_path: Target directory to extract files into.

    Returns:
        dict: Summary of archive operation.
    """
    archive = Path(zip_path).resolve()
    act = action.strip().lower()

    try:
        if act == "compress":
            if not source_paths or len(source_paths) == 0:
                return {
                    "success": False,
                    "error": "source_paths list is required for compression.",
                    "archive_path": str(archive),
                }

            archive.parent.mkdir(parents=True, exist_ok=True)
            added_files: list[str] = []

            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for src in source_paths:
                    p = Path(src).resolve()
                    if not p.exists():
                        continue
                    if p.is_file():
                        zf.write(p, arcname=p.name)
                        added_files.append(p.name)
                    elif p.is_dir():
                        for child in p.rglob("*"):
                            if child.is_file():
                                arc_name = child.relative_to(p.parent)
                                zf.write(child, arcname=str(arc_name))
                                added_files.append(str(arc_name))

            return {
                "success": True,
                "action": "compress",
                "archive_path": str(archive),
                "total_files_added": len(added_files),
                "archive_size_bytes": archive.stat().st_size,
                "files": added_files,
            }

        elif act == "extract":
            if not archive.exists() or not archive.is_file():
                return {
                    "success": False,
                    "error": f"Zip archive not found: {zip_path}",
                    "archive_path": str(archive),
                }

            dest = Path(destination_path or archive.parent / archive.stem).resolve()
            dest.mkdir(parents=True, exist_ok=True)
            extracted_files: list[str] = []

            with zipfile.ZipFile(archive, "r") as zf:
                for member in zf.infolist():
                    # Zip slip vulnerability prevention
                    target = (dest / member.filename).resolve()
                    if not str(target).startswith(str(dest)):
                        return {
                            "success": False,
                            "error": f"Security violation: path traversal detected in {member.filename}",
                        }

                    zf.extract(member, dest)
                    if not member.is_dir():
                        extracted_files.append(member.filename)

            return {
                "success": True,
                "action": "extract",
                "archive_path": str(archive),
                "destination_path": str(dest),
                "total_files_extracted": len(extracted_files),
                "files": extracted_files,
            }

        elif act == "list":
            if not archive.exists() or not archive.is_file():
                return {
                    "success": False,
                    "error": f"Zip archive not found: {zip_path}",
                    "archive_path": str(archive),
                }

            file_list: list[dict[str, Any]] = []
            with zipfile.ZipFile(archive, "r") as zf:
                for info in zf.infolist():
                    file_list.append({
                        "filename": info.filename,
                        "file_size": info.file_size,
                        "compress_size": info.compress_size,
                        "is_dir": info.is_dir(),
                    })

            return {
                "success": True,
                "action": "list",
                "archive_path": str(archive),
                "total_items": len(file_list),
                "items": file_list,
            }

        return {
            "success": False,
            "error": f"Unsupported action '{action}'. Use 'compress', 'extract', or 'list'.",
        }

    except Exception as exc:
        return {
            "success": False,
            "error": f"Zip operation failed: {exc}",
            "archive_path": str(archive),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return compress_extract_zip(**kwargs)
