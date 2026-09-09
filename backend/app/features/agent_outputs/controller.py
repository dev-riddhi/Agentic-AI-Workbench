import mimetypes
import os
from pathlib import Path
from typing import Sequence
from uuid import UUID

from fastapi import HTTPException, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.features.agent_outputs import model
from app.features.agent_outputs.schemas import AgentOutputPreviewResponse
from app.tools.file.file_security import get_upload_dir, resolve_safe_path
from database.models.agent_output import AgentOutput


def _resolve_output_file_path(file_path: str | None) -> Path | None:
    if not file_path:
        return None

    raw_path = Path(file_path)
    if raw_path.is_absolute() and raw_path.exists():
        return raw_path

    # Try resolving via uploads directory
    try:
        safe = resolve_safe_path(file_path)
        if safe.exists():
            return safe
    except Exception:
        pass

    # Check relative to backend root and backend/outputs
    backend_root = Path(__file__).resolve().parents[3]
    candidate = (backend_root / file_path).resolve()
    if candidate.exists():
        return candidate

    outputs_candidate = (backend_root / "outputs" / Path(file_path).name).resolve()
    if outputs_candidate.exists():
        return outputs_candidate

    return raw_path if raw_path.exists() else None


def list_outputs_controller(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    agent_id: UUID | None = None,
    output_type: str | None = None,
    search: str | None = None,
) -> Sequence[AgentOutput]:
    return model.get_agent_outputs(
        db=db,
        skip=skip,
        limit=limit,
        agent_id=agent_id,
        output_type=output_type,
        search=search,
    )


def get_output_by_id_controller(db: Session, output_id: UUID) -> AgentOutput:
    output = model.get_agent_output_by_id(db=db, output_id=output_id)
    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent output with ID '{output_id}' was not found.",
        )
    return output


def download_output_controller(db: Session, output_id: UUID) -> Response:
    output = get_output_by_id_controller(db=db, output_id=output_id)

    actual_file = _resolve_output_file_path(output.file_path)

    if actual_file and actual_file.is_file():
        actual_name = actual_file.name
        actual_ext = actual_file.suffix.lower()

        # If output.title is present, use it but guarantee it carries the actual file extension
        if output.title and output.title.strip():
            base_title = output.title.strip()
            if actual_ext and not base_title.lower().endswith(actual_ext):
                download_filename = f"{base_title}{actual_ext}"
            else:
                download_filename = base_title
        else:
            download_filename = actual_name

        media_type = output.mime_type or mimetypes.guess_type(str(actual_file))[0] or "application/octet-stream"
        return FileResponse(
            path=str(actual_file),
            filename=download_filename,
            media_type=media_type,
            headers={
                "Access-Control-Expose-Headers": "Content-Disposition",
                "Content-Disposition": f'attachment; filename="{download_filename}"',
            },
        )

    # If physical file is missing but text content_preview is stored, stream it with proper extension
    if output.content_preview:
        ext = f".{output.output_type.lower().lstrip('.')}" if output.output_type else ".txt"
        if ext in (".file", ".other", ".none", "."):
            ext = ".txt"
        elif ext == ".markdown":
            ext = ".md"

        if output.title and output.title.strip():
            base_title = output.title.strip()
            download_filename = base_title if base_title.lower().endswith(ext) else f"{base_title}{ext}"
        else:
            download_filename = f"output{ext}"

        media_type = output.mime_type or mimetypes.guess_type(download_filename)[0] or "text/plain; charset=utf-8"
        return Response(
            content=output.content_preview.encode("utf-8"),
            media_type=media_type,
            headers={
                "Access-Control-Expose-Headers": "Content-Disposition",
                "Content-Disposition": f'attachment; filename="{download_filename}"',
            },
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Output file for '{output.title}' does not exist on storage.",
    )


def preview_output_controller(db: Session, output_id: UUID) -> AgentOutputPreviewResponse:
    output = get_output_by_id_controller(db=db, output_id=output_id)
    actual_file = _resolve_output_file_path(output.file_path)

    text_extensions = {".txt", ".md", ".json", ".csv", ".tsv", ".xml", ".html", ".py", ".yaml", ".yml", ".sql"}
    is_text = False
    content_text: str | None = None

    if actual_file and actual_file.is_file():
        ext = actual_file.suffix.lower()
        if ext in text_extensions or (output.mime_type and "text" in output.mime_type):
            is_text = True
            try:
                with open(actual_file, "r", encoding="utf-8", errors="replace") as f:
                    content_text = f.read(100000)  # Read up to ~100KB for preview
            except Exception:
                content_text = output.content_preview
        else:
            is_text = False
            content_text = output.content_preview
    else:
        content_text = output.content_preview
        is_text = True

    return AgentOutputPreviewResponse(
        id=output.id,
        title=output.title,
        output_type=output.output_type,
        file_path=output.file_path,
        file_size=output.file_size,
        mime_type=output.mime_type,
        content=content_text,
        is_binary=not is_text,
    )


def delete_output_controller(db: Session, output_id: UUID) -> None:
    output = get_output_by_id_controller(db=db, output_id=output_id)

    actual_file = _resolve_output_file_path(output.file_path)
    if actual_file and actual_file.is_file():
        try:
            actual_file.unlink()
        except OSError:
            pass

    model.delete_agent_output(db=db, output=output)
