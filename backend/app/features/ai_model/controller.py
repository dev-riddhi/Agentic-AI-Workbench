import os
import re
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from huggingface_hub import hf_hub_download
from sqlalchemy.orm import Session

from app.features.ai_model import model
from app.features.ai_model.schemas import AIModelDownloadRequest
from database.database import SessionLocal
from database.models import AIModel

AI_MODELS_DIR = os.getenv("AI_MODELS_DIR", "models")
os.makedirs(AI_MODELS_DIR, exist_ok=True)


def extract_quantization(filename: str) -> str | None:
    match = re.search(r"(?i)\b(q[0-9]_[a-z0-9_]+|f16|f32|bf16)\b", filename)
    return match.group(1).upper() if match else None


def execute_hf_download(
    model_id: UUID,
    repo_id: str,
    filename: str,
    target_dir: str,
) -> None:
    with SessionLocal() as db:
        ai_model = model.get_ai_model_by_id(db, model_id)
        if not ai_model:
            return

        try:
            downloaded_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                local_dir=target_dir,
            )
            file_size = (
                os.path.getsize(downloaded_path)
                if os.path.exists(downloaded_path)
                else None
            )
            model.update_ai_model_status(
                db=db,
                model=ai_model,
                status="ready",
                file_path=downloaded_path,
                size_bytes=file_size,
            )
        except Exception as exc:
            model.update_ai_model_status(
                db=db,
                model=ai_model,
                status="failed",
                error_message=str(exc),
            )


def download_ai_model_controller(
    db: Session,
    download_req: AIModelDownloadRequest,
    background_tasks: BackgroundTasks | None = None,
    run_in_background: bool = True,
) -> AIModel:
    filename = download_req.filename.strip()
    if not filename.lower().endswith(".gguf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .gguf model files are supported",
        )

    # Check if model already registered
    existing_model = model.get_ai_model_by_repo_and_file(
        db=db,
        repo_id=download_req.repo_id,
        filename=filename,
    )
    if existing_model and existing_model.status in ("ready", "downloading"):
        return existing_model

    safe_repo_dir = download_req.repo_id.replace("/", "--")
    target_dir = os.path.join(AI_MODELS_DIR, safe_repo_dir)
    os.makedirs(target_dir, exist_ok=True)
    expected_path = os.path.join(target_dir, filename)

    friendly_name = download_req.name or filename
    quant = download_req.quantization or extract_quantization(filename)

    if existing_model:
        ai_model = model.update_ai_model_status(
            db=db,
            model=existing_model,
            status="downloading",
            file_path=expected_path,
            error_message=None,
        )
    else:
        ai_model = model.create_ai_model(
            db=db,
            name=friendly_name,
            repo_id=download_req.repo_id,
            filename=filename,
            file_path=expected_path,
            format="gguf",
            quantization=quant,
            status="downloading",
        )

    if run_in_background and background_tasks is not None:
        background_tasks.add_task(
            execute_hf_download,
            model_id=ai_model.id,
            repo_id=download_req.repo_id,
            filename=filename,
            target_dir=target_dir,
        )
        return ai_model
    else:
        execute_hf_download(
            model_id=ai_model.id,
            repo_id=download_req.repo_id,
            filename=filename,
            target_dir=target_dir,
        )
        db.expire_all()
        refreshed = model.get_ai_model_by_id(db, ai_model.id)
        return refreshed or ai_model


def get_ai_models_controller(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[AIModel]:
    return model.get_ai_models(db=db, skip=skip, limit=limit)


def get_ai_model_by_id_controller(db: Session, model_id: UUID) -> AIModel:
    ai_model = model.get_ai_model_by_id(db=db, model_id=model_id)
    if not ai_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Model not found",
        )
    return ai_model


def delete_ai_model_controller(db: Session, model_id: UUID) -> None:
    ai_model = model.get_ai_model_by_id(db=db, model_id=model_id)
    if not ai_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Model not found",
        )

    if os.path.exists(ai_model.file_path):
        try:
            os.remove(ai_model.file_path)
        except OSError:
            pass

    model.delete_ai_model(db=db, model=ai_model)
