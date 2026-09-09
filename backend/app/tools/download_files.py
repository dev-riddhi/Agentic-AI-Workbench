"""Tool: Download Files
Streams and downloads files from URLs to local paths with SHA-256 validation and chunked writing.
"""

import hashlib
from pathlib import Path
from typing import Any
import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


from app.tools.file.file_security import resolve_safe_path


def download_files(
    url: str,
    destination_path: str,
    overwrite: bool = True,
    expected_sha256: str | None = None,
    timeout: float = 60.0,
) -> dict[str, Any]:
    """Downloads a file from a URL to a destination path inside the uploads directory.

    Args:
        url: Direct HTTP/HTTPS download link.
        destination_path: Path inside uploads where downloaded contents should be saved.
        overwrite: If False and destination file already exists, aborts download.
        expected_sha256: Optional hex string to verify file integrity.
        timeout: Download timeout in seconds.

    Returns:
        dict: Result containing 'success', 'file_path', 'size_bytes', and 'sha256'.
    """
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    try:
        dest = resolve_safe_path(destination_path)
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": str(err),
            "file_path": str(destination_path),
        }

    if not overwrite and dest.exists():
        return {
            "success": False,
            "error": f"Destination file exists and overwrite is False: {destination_path}",
            "file_path": str(dest),
        }

    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        hasher = hashlib.sha256()
        total_downloaded = 0

        headers = {"User-Agent": DEFAULT_USER_AGENT}
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            with client.stream("GET", clean_url, headers=headers) as resp:
                resp.raise_for_status()
                with open(dest, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                            hasher.update(chunk)
                            total_downloaded += len(chunk)

        computed_hash = hasher.hexdigest()

        if expected_sha256 and computed_hash.lower() != expected_sha256.strip().lower():
            dest.unlink(missing_ok=True)
            return {
                "success": False,
                "error": (
                    f"Checksum mismatch: expected {expected_sha256} but got {computed_hash}."
                ),
                "url": clean_url,
                "file_path": str(dest),
            }

        return {
            "success": True,
            "url": clean_url,
            "file_path": str(dest),
            "size_bytes": total_downloaded,
            "sha256": computed_hash,
        }

    except Exception as exc:
        if dest.exists():
            dest.unlink(missing_ok=True)
        return {
            "success": False,
            "error": f"Failed downloading file: {exc}",
            "url": clean_url,
            "file_path": str(dest),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return download_files(**kwargs)
