"""Tool: Compress / Extract ZIP
Creates zip archives or extracts archives with Zip Slip path-traversal prevention.
"""

import os
from pathlib import Path
from typing import Any
import zipfile


from app.tools.file.file_security import resolve_safe_path


def compress_extract_zip(
    action: str,
    zip_path: str,
    source_paths: list[str] | None = None,
    destination_path: str | None = None,
) -> dict[str, Any]:
    """Compresses files/folders into a ZIP or extracts files from a ZIP archive inside uploads.

    Args:
        action: 'compress', 'extract', or 'list'.
        zip_path: Path to the target or source .zip file inside uploads.
        source_paths: List of file/folder paths inside uploads to include when compressing.
        destination_path: Target directory inside uploads to extract files into.

    Returns:
        dict: Summary of archive operation.
    """
    try:
        archive = resolve_safe_path(zip_path)
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": str(err),
            "archive_path": zip_path,
        }

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
                    try:
                        p = resolve_safe_path(src)
                    except (PermissionError, ValueError) as err:
                        return {
                            "success": False,
                            "error": f"Security violation in source_path: {err}",
                            "archive_path": str(archive),
                        }
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

            try:
                dest = resolve_safe_path(destination_path or (archive.parent / archive.stem), default_to_root=True)
            except (PermissionError, ValueError) as err:
                return {
                    "success": False,
                    "error": str(err),
                    "archive_path": str(archive),
                }

            dest.mkdir(parents=True, exist_ok=True)
            extracted_files: list[str] = []

            norm_dest = Path(os.path.normcase(str(dest)))

            with zipfile.ZipFile(archive, "r") as zf:
                for member in zf.infolist():
                    # Zip slip vulnerability prevention
                    target = (dest / member.filename).resolve()
                    norm_target = Path(os.path.normcase(str(target)))
                    if not (norm_target == norm_dest or norm_target.is_relative_to(norm_dest)):
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
