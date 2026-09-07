"""File Security & Sandbox Utility for Tools.

Restricts file operations performed by agent tools strictly to the designated
uploads directory (configured via the UPLOAD_DIR environment variable or
defaulting to <backend>/uploads).
"""

import os
from pathlib import Path


def get_upload_dir() -> Path:
    """Retrieves and creates the canonical uploads directory path.

    Honors the UPLOAD_DIR environment variable if set. Defaults to the
    'uploads' folder located in the backend root directory.
    """
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        p = Path(env_dir)
        if not p.is_absolute():
            backend_dir = Path(__file__).resolve().parents[2]
            upload_dir = (backend_dir / p).resolve()
        else:
            upload_dir = p.resolve()
    else:
        backend_dir = Path(__file__).resolve().parents[2]
        upload_dir = (backend_dir / "uploads").resolve()

    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def resolve_safe_path(
    user_path: str | Path | None,
    default_to_root: bool = False,
) -> Path:
    """Resolves a user/agent provided path strictly within the uploads directory.

    Args:
        user_path: Relative or absolute path provided to a tool.
        default_to_root: If True, empty paths or '.' default to the upload directory root.

    Returns:
        Path: Canonical resolved Path inside the uploads directory.

    Raises:
        ValueError: If path is empty and default_to_root is False.
        PermissionError: If the path attempts path traversal or points outside the uploads directory.
    """
    upload_dir = get_upload_dir()

    if not user_path or str(user_path).strip() in ("", "."):
        if default_to_root:
            return upload_dir
        raise ValueError("File path cannot be empty.")

    raw = str(user_path).strip().replace("\\", "/")

    # Normalize leading relative prefix if present
    if raw.startswith("./"):
        raw = raw[2:]

    # If the user explicitly provided 'uploads' or 'uploads/...' as a relative path,
    # normalize it so it resolves relative to upload_dir without double-nesting.
    if raw == "uploads":
        return upload_dir
    if raw.startswith("uploads/"):
        raw = raw[len("uploads/") :]

    p = Path(raw)
    if p.is_absolute():
        resolved = p.resolve()
    else:
        resolved = (upload_dir / p).resolve()

    norm_resolved = Path(os.path.normcase(str(resolved)))
    norm_upload = Path(os.path.normcase(str(upload_dir)))

    # Containment check: must be the upload_dir itself or a child of upload_dir
    if not (norm_resolved == norm_upload or norm_resolved.is_relative_to(norm_upload)):
        raise PermissionError(
            f"Access denied: Path '{user_path}' is outside the permitted uploads directory ({upload_dir})."
        )

    return resolved
