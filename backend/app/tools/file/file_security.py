"""File Security & Sandbox Utility for Tools.

Restricts file operations performed by agent tools:
- Read operations can execute across permitted folders (uploads, outputs).
- Destructive/write operations (create, edit, delete, rename) are strictly constrained to the backend/outputs folder.
"""

import os
from pathlib import Path


def _get_backend_dir() -> Path:
    """Safely locates the backend root directory."""
    current = Path(__file__).resolve().parent
    for p in [current, *current.parents]:
        if (p / "outputs").exists() or ((p / "app").exists() and (p / "main.py").exists()):
            return p
    return Path(__file__).resolve().parents[3]


def get_upload_dir() -> Path:
    """Retrieves and creates the canonical uploads directory path."""
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        p = Path(env_dir)
        if not p.is_absolute():
            backend_dir = _get_backend_dir()
            upload_dir = (backend_dir / p).resolve()
        else:
            upload_dir = p.resolve()
    else:
        backend_dir = _get_backend_dir()
        upload_dir = (backend_dir / "uploads").resolve()

    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def get_outputs_dir() -> Path:
    """Retrieves and creates the canonical backend/outputs directory path."""
    backend_dir = _get_backend_dir()
    outputs_dir = (backend_dir / "outputs").resolve()
    outputs_dir.mkdir(parents=True, exist_ok=True)
    return outputs_dir


def resolve_output_path(
    user_path: str | Path | None,
    default_to_root: bool = False,
) -> Path:
    """Resolves a user/agent provided path strictly within the backend/outputs directory.

    Ensures all writes, creations, edits, and deletions are strictly confined to backend/outputs.

    Args:
        user_path: Target filename or relative path inside backend/outputs.
        default_to_root: If True, empty paths default to outputs root.

    Returns:
        Path: Canonical resolved Path inside the backend/outputs directory.

    Raises:
        ValueError: If path is empty and default_to_root is False.
        PermissionError: If path attempts path traversal or points outside backend/outputs.
    """
    outputs_dir = get_outputs_dir()

    if not user_path or str(user_path).strip() in ("", "."):
        if default_to_root:
            return outputs_dir
        raise ValueError("File path cannot be empty.")

    raw = str(user_path).strip().replace("\\", "/")
    while raw.startswith("./"):
        raw = raw[2:]

    # Normalize leading prefixes for outputs
    if raw.startswith("outputs/"):
        raw = raw[len("outputs/") :]
    elif raw.startswith("uploads/outputs/"):
        raw = raw[len("uploads/outputs/") :]
    elif raw.startswith("uploads/"):
        raise PermissionError(
            f"Access denied: Operation cannot target the uploads directory ('{user_path}'). Writes and mutations are strictly restricted to the outputs folder."
        )

    p = Path(raw)
    if p.is_absolute():
        resolved = p.resolve()
    else:
        resolved = (outputs_dir / p).resolve()

    norm_resolved = Path(os.path.normcase(str(resolved)))
    norm_outputs = Path(os.path.normcase(str(outputs_dir)))

    # Strict containment check in outputs directory
    if not (norm_resolved == norm_outputs or norm_resolved.is_relative_to(norm_outputs)):
        raise PermissionError(
            f"Access denied: Operation is strictly restricted to the outputs folder. Target '{user_path}' is outside permitted outputs directory ({outputs_dir})."
        )

    return resolved


def resolve_safe_path(
    user_path: str | Path | None,
    default_to_root: bool = False,
) -> Path:
    """Resolves a path for reading and inspection tools.

    Permits reading from the uploads directory as well as the outputs directory.

    Args:
        user_path: Relative or absolute path provided to a tool.
        default_to_root: If True, empty paths default to the uploads root.

    Returns:
        Path: Canonical resolved Path.

    Raises:
        ValueError: If path is empty and default_to_root is False.
        PermissionError: If path points outside permitted workspaces.
    """
    upload_dir = get_upload_dir()
    outputs_dir = get_outputs_dir()

    if not user_path or str(user_path).strip() in ("", "."):
        if default_to_root:
            return upload_dir
        raise ValueError("File path cannot be empty.")

    raw = str(user_path).strip().replace("\\", "/")
    while raw.startswith("./"):
        raw = raw[2:]

    # Check if explicitly targeting outputs
    if raw.startswith("outputs/"):
        rel_out = raw[len("outputs/") :]
        return (outputs_dir / rel_out).resolve()
    if raw.startswith("uploads/outputs/"):
        rel_out = raw[len("uploads/outputs/") :]
        return (outputs_dir / rel_out).resolve()

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
    norm_outputs = Path(os.path.normcase(str(outputs_dir)))

    # Containment check in upload_dir or outputs_dir
    in_upload = norm_resolved == norm_upload or norm_resolved.is_relative_to(norm_upload)
    in_outputs = norm_resolved == norm_outputs or norm_resolved.is_relative_to(norm_outputs)

    if not (in_upload or in_outputs):
        raise PermissionError(
            f"Access denied: Path '{user_path}' is outside permitted directories."
        )

    # Fallback: if not found in upload_dir, check outputs_dir
    if not resolved.exists():
        candidate_outputs = (outputs_dir / p).resolve()
        if candidate_outputs.exists():
            return candidate_outputs

    return resolved
