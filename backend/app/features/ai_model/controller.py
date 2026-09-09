import logging
import os
from pathlib import Path
import re
import shutil
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, UploadFile, status
from gguf import GGUFReader
from huggingface_hub import hf_hub_download
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.features.ai_model import model
from app.features.ai_model.schemas import AIModelDownloadRequest
from database.database import SessionLocal
from database.models import AIModel

AI_MODELS_DIR = os.getenv("AI_MODELS_DIR", "models")
os.makedirs(AI_MODELS_DIR, exist_ok=True)

# In-memory store for active Hugging Face download progress: model_id_str -> dict
ACTIVE_DOWNLOADS: dict[str, dict[str, Any]] = {}


def make_progress_tracker(model_id_str: str):
    from tqdm.auto import tqdm

    class DownloadProgressTracker(tqdm):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            if model_id_str in ACTIVE_DOWNLOADS:
                ACTIVE_DOWNLOADS[model_id_str]["total_bytes"] = self.total or 0

        def update(self, n=1):
            super().update(n)
            if model_id_str in ACTIVE_DOWNLOADS:
                rec = ACTIVE_DOWNLOADS[model_id_str]
                rec["downloaded_bytes"] = self.n
                if self.total and self.total > 0:
                    rec["total_bytes"] = self.total
                    rec["percent"] = round((self.n * 100) / self.total, 1)
                rate = self.format_dict.get("rate")
                if rate:
                    if rate >= 1024 * 1024:
                        rec["speed"] = f"{rate / (1024 * 1024):.1f} MB/s"
                    elif rate >= 1024:
                        rec["speed"] = f"{rate / 1024:.1f} KB/s"
                    else:
                        rec["speed"] = f"{rate:.0f} B/s"

    return DownloadProgressTracker


def normalize_repo_id(repo_id: str) -> tuple[str, str | None]:
    clean = repo_id.strip()
    for prefix in ("https://huggingface.co/", "http://huggingface.co/"):
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
    clean = clean.strip("/")
    parts = clean.split("/")
    if len(parts) >= 2:
        extracted = f"{parts[0]}/{parts[1]}"
        if len(parts) >= 5 and parts[2] in ("blob", "resolve") and parts[-1].lower().endswith(".gguf"):
            return extracted, parts[-1]
        return extracted, None
    return clean, None


def resolve_repo_gguf_file(repo_id: str) -> str:
    try:
        from huggingface_hub import list_repo_files
        files = list_repo_files(repo_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to query Hugging Face repository '{repo_id}': {str(exc)}",
        )
    gguf_files = [f for f in files if f.lower().endswith(".gguf")]
    if not gguf_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No .gguf model files found in Hugging Face repository '{repo_id}'",
        )
    preferred_quants = ["q4_k_m", "q4_0", "q5_k_m", "q4_k_s", "q5_0", "q8_0"]
    for pref in preferred_quants:
        for gf in gguf_files:
            if pref in gf.lower():
                return gf
    return gguf_files[0]


def extract_gguf_metadata(file_path: str, filename: str) -> tuple[str, str | None]:
    """Uses gguf.GGUFReader to extract friendly display name and quantization profile from a .gguf binary."""
    safe_filename = os.path.basename(filename)
    friendly_name: str | None = None
    quant: str | None = None

    try:
        reader = GGUFReader(file_path)

        def get_field_val(field_name: str) -> str | None:
            f = reader.fields.get(field_name)
            if not f:
                return None
            try:
                val = f.contents()
                if isinstance(val, (bytes, bytearray)):
                    return val.decode("utf-8", errors="ignore").strip()
                return str(val).strip()
            except Exception:
                return None

        # 1. Extract model name from GGUF metadata
        gguf_name = (
            get_field_val("general.name")
            or get_field_val("general.basename")
            or get_field_val("general.base_model.0.name")
        )

        # 2. Extract quantization type from GGUF tensors
        tensor_quant_types = [
            t.tensor_type.name
            for t in reader.tensors
            if t.tensor_type.name not in ("F32", "F16", "UNKNOWN")
        ]
        if tensor_quant_types:
            quant = max(set(tensor_quant_types), key=tensor_quant_types.count).upper()
        else:
            quant = extract_quantization(safe_filename)

        base_name = safe_filename[:-5] if safe_filename.lower().endswith(".gguf") else safe_filename
        model_name = gguf_name or base_name

        if quant and quant not in model_name.upper():
            friendly_name = f"{model_name} ({quant})"
        else:
            friendly_name = model_name

    except Exception as exc:
        logger.warning("Failed to extract GGUFReader metadata for '%s': %s", file_path, exc)
        base_name = safe_filename[:-5] if safe_filename.lower().endswith(".gguf") else safe_filename
        quant = extract_quantization(safe_filename) or "CUSTOM"
        friendly_name = f"{base_name} ({quant})" if quant and quant not in base_name else base_name

    return friendly_name, quant


def extract_quantization(filename: str) -> str | None:
    match = re.search(r"(?i)\b(q[0-9]_[a-z0-9_]+|f16|f32|bf16)\b", filename)
    return match.group(1).upper() if match else None


def execute_hf_download(
    model_id: UUID,
    repo_id: str,
    filename: str,
    target_dir: str,
) -> None:
    model_id_str = str(model_id)
    with SessionLocal() as db:
        ai_model = model.get_ai_model_by_id(db, model_id)
        if not ai_model:
            return

        try:
            tracker_cls = make_progress_tracker(model_id_str)
            downloaded_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                local_dir=target_dir,
                tqdm_class=tracker_cls,
            )
            file_size = (
                os.path.getsize(downloaded_path)
                if os.path.exists(downloaded_path)
                else None
            )

            # Metadata extraction phase using GGUFReader
            if model_id_str in ACTIVE_DOWNLOADS:
                ACTIVE_DOWNLOADS[model_id_str]["status"] = "extracting_metadata"
                ACTIVE_DOWNLOADS[model_id_str]["percent"] = 100.0

            friendly_name, quant = extract_gguf_metadata(downloaded_path, filename)

            ai_model.name = friendly_name
            ai_model.quantization = quant
            model.update_ai_model_status(
                db=db,
                model=ai_model,
                status="ready",
                file_path=downloaded_path,
                size_bytes=file_size,
            )

            if model_id_str in ACTIVE_DOWNLOADS:
                ACTIVE_DOWNLOADS[model_id_str]["status"] = "ready"
                ACTIVE_DOWNLOADS[model_id_str]["percent"] = 100.0
                ACTIVE_DOWNLOADS[model_id_str]["name"] = friendly_name
                ACTIVE_DOWNLOADS[model_id_str]["quantization"] = quant

        except Exception as exc:
            logger.error("HF download failed for %s (%s/%s): %s", model_id, repo_id, filename, exc)
            if model_id_str in ACTIVE_DOWNLOADS:
                ACTIVE_DOWNLOADS[model_id_str]["status"] = "failed"
                ACTIVE_DOWNLOADS[model_id_str]["error"] = str(exc)
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
    norm_repo, extracted_filename = normalize_repo_id(download_req.repo_id)
    filename = (download_req.filename.strip() if download_req.filename and download_req.filename.strip() else None) or extracted_filename

    if not filename:
        filename = resolve_repo_gguf_file(norm_repo)

    if not filename.lower().endswith(".gguf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .gguf model files are supported",
        )

    # Check if model already registered
    existing_model = model.get_ai_model_by_repo_and_file(
        db=db,
        repo_id=norm_repo,
        filename=filename,
    )
    if existing_model and existing_model.status in ("ready", "downloading"):
        return existing_model

    safe_repo_dir = norm_repo.replace("/", "--")
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
            repo_id=norm_repo,
            filename=filename,
            file_path=expected_path,
            format="gguf",
            quantization=quant,
            status="downloading",
        )

    model_id_str = str(ai_model.id)
    ACTIVE_DOWNLOADS[model_id_str] = {
        "model_id": model_id_str,
        "repo_id": norm_repo,
        "filename": filename,
        "status": "downloading",
        "downloaded_bytes": 0,
        "total_bytes": 0,
        "percent": 0.0,
        "speed": None,
        "error": None,
    }

    if run_in_background and background_tasks is not None:
        background_tasks.add_task(
            execute_hf_download,
            model_id=ai_model.id,
            repo_id=norm_repo,
            filename=filename,
            target_dir=target_dir,
        )
        return ai_model
    else:
        execute_hf_download(
            model_id=ai_model.id,
            repo_id=norm_repo,
            filename=filename,
            target_dir=target_dir,
        )
        db.expire_all()
        refreshed = model.get_ai_model_by_id(db, ai_model.id)
        return refreshed or ai_model


def get_download_progress_controller(db: Session, model_id: UUID) -> dict[str, Any]:
    model_id_str = str(model_id)
    if model_id_str in ACTIVE_DOWNLOADS:
        return ACTIVE_DOWNLOADS[model_id_str]

    ai_model = model.get_ai_model_by_id(db, model_id)
    if not ai_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Model not found",
        )

    return {
        "model_id": model_id_str,
        "repo_id": ai_model.repo_id,
        "filename": ai_model.filename,
        "name": ai_model.name,
        "quantization": ai_model.quantization,
        "status": ai_model.status,
        "downloaded_bytes": ai_model.size_bytes or 0,
        "total_bytes": ai_model.size_bytes or 0,
        "percent": 100.0 if ai_model.status == "ready" else 0.0,
        "speed": None,
        "error": ai_model.error_message,
    }


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


def upload_ai_model_controller(
    db: Session,
    file: UploadFile,
    name: str | None = None,
    quantization: str | None = None,
    repo_id: str = "local-upload",
) -> AIModel:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot be empty",
        )

    safe_filename = os.path.basename(file.filename)
    if not safe_filename.lower().endswith(".gguf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .gguf model files are supported for local upload",
        )

    target_dir = os.path.join(AI_MODELS_DIR, repo_id)
    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, safe_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write model file to storage: {str(exc)}",
        )
    finally:
        file.file.close()

    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else None

    # Use GGUFReader to automatically read model info from the uploaded binary
    friendly_name, quant = extract_gguf_metadata(file_path, safe_filename)

    # Override with caller-provided name or quantization if explicitly passed
    if name and name.strip():
        friendly_name = name.strip()
    if quantization and quantization.strip():
        quant = quantization.strip().upper()

    # Check if model is already registered by filename, file_path, or repo_id
    existing_model = model.get_ai_model_by_filename_or_path(
        db=db,
        filename=safe_filename,
        file_path=file_path,
        repo_id=repo_id,
    )
    if existing_model:
        existing_model.name = friendly_name
        existing_model.quantization = quant
        return model.update_ai_model_status(
            db=db,
            model=existing_model,
            status="ready",
            file_path=file_path,
            size_bytes=file_size,
            error_message=None,
        )

    return model.create_ai_model(
        db=db,
        name=friendly_name,
        repo_id=repo_id,
        filename=safe_filename,
        file_path=file_path,
        format="gguf",
        quantization=quant,
        size_bytes=file_size,
        status="ready",
    )


def check_llama_server_and_get_models(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> dict:
    backend_dir = Path(__file__).resolve().parents[3]
    primary_server_exe = backend_dir / "llama.cpp" / "bin" / "Release" / "llama-server.exe"

    candidate_paths = [
        primary_server_exe,
        backend_dir / "llama.cpp" / "build" / "bin" / "Release" / "llama-server.exe",
        backend_dir / "llama.cpp" / "build" / "bin" / "llama-server.exe",
        backend_dir / "llama.cpp" / "bin" / "llama-server.exe",
    ]

    server_path = None
    for candidate in candidate_paths:
        if candidate.is_file():
            server_path = candidate
            break

    if not server_path:
        return {
            "installed": False,
            "message": "llama.cpp is not installed",
            "server_path": None,
            "models": [],
        }

    # If binary found in build/bin but primary bin/Release path missing, ensure directory link
    if not primary_server_exe.is_file() and server_path.is_file():
        try:
            primary_server_exe.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(server_path, primary_server_exe)
            server_path = primary_server_exe
        except Exception:
            pass

    models_list = model.get_ai_models(db=db, skip=skip, limit=limit)
    return {
        "installed": True,
        "message": "llama.cpp is installed",
        "server_path": str(server_path),
        "models": models_list,
    }

