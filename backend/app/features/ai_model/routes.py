from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.features.ai_model import controller
from app.features.ai_model.schemas import (
    AIModelDownloadRequest,
    AIModelResponse,
    LlamaServerStatusResponse,
    ModelRuntimeStartRequest,
)
from app.features.user.controller import get_current_user, get_optional_current_user
from app.runtime.model_runtime import model_runtime
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/models")


@router.post("/upload", response_model=AIModelResponse, status_code=status.HTTP_201_CREATED)
@router.post("/upload/", response_model=AIModelResponse, status_code=status.HTTP_201_CREATED)
def upload_model(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    quantization: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.upload_ai_model_controller(
        db=db,
        file=file,
        name=name,
        quantization=quantization,
    )


@router.post("/download", response_model=AIModelResponse, status_code=status.HTTP_202_ACCEPTED)
@router.post("/download/", response_model=AIModelResponse, status_code=status.HTTP_202_ACCEPTED)
def download_model(
    download_req: AIModelDownloadRequest,
    background_tasks: BackgroundTasks,
    background: bool = True,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.download_ai_model_controller(
        db=db,
        download_req=download_req,
        background_tasks=background_tasks,
        run_in_background=background,
    )


@router.get("", response_model=list[AIModelResponse], status_code=status.HTTP_200_OK)
@router.get("/", response_model=list[AIModelResponse], status_code=status.HTTP_200_OK)
def get_models(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.get_ai_models_controller(db=db, skip=skip, limit=limit)


@router.get("/status", response_model=LlamaServerStatusResponse, status_code=status.HTTP_200_OK)
@router.get("/check", response_model=LlamaServerStatusResponse, status_code=status.HTTP_200_OK)
def check_llama_status(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return controller.check_llama_server_and_get_models(db=db, skip=skip, limit=limit)


@router.post("/runtime/start", status_code=status.HTTP_200_OK)
def start_runtime(
    req: ModelRuntimeStartRequest,
    current_user: User | None = Depends(get_optional_current_user),
):
    try:
        return model_runtime.start(
            model_identifier=req.model,
            host=req.host,
            port=req.port,
            ctx_size=req.ctx_size,
            n_gpu_layers=req.n_gpu_layers,
            threads=req.threads,
            n_cpu_moe=req.n_cpu_moe,
            mmap=req.mmap,
            mlock=req.mlock,
            cache_type_k=req.cache_type_k,
            cache_type_v=req.cache_type_v,
            wait_ready=req.wait_ready,
            timeout=req.timeout,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post("/runtime/stop", status_code=status.HTTP_200_OK)
def stop_runtime(current_user: User | None = Depends(get_optional_current_user)):
    return model_runtime.stop()


@router.get("/runtime/status", status_code=status.HTTP_200_OK)
def get_runtime_status(current_user: User | None = Depends(get_optional_current_user)):
    return model_runtime.get_status()


@router.get("/runtime/logs", status_code=status.HTTP_200_OK)
def get_runtime_logs(
    lines: int = 100,
    current_user: User | None = Depends(get_optional_current_user),
):
    return {"logs": model_runtime.get_logs(lines=lines)}


@router.get("/{id}/progress", status_code=status.HTTP_200_OK)
def get_download_progress(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_download_progress_controller(db=db, model_id=id)


@router.get("/{id}", response_model=AIModelResponse, status_code=status.HTTP_200_OK)
def get_model(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.get_ai_model_by_id_controller(db=db, model_id=id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    controller.delete_ai_model_controller(db=db, model_id=id)
