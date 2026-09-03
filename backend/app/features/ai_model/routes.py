from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from app.features.ai_model import controller
from app.features.ai_model.schemas import (
    AIModelDownloadRequest,
    AIModelResponse,
)
from app.features.user.controller import get_current_user
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/models")


@router.post("/download", response_model=AIModelResponse, status_code=status.HTTP_202_ACCEPTED)
def download_model(
    download_req: AIModelDownloadRequest,
    background_tasks: BackgroundTasks,
    background: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.download_ai_model_controller(
        db=db,
        download_req=download_req,
        background_tasks=background_tasks,
        run_in_background=background,
    )


@router.get("/", response_model=list[AIModelResponse], status_code=status.HTTP_200_OK)
def get_models(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_ai_models_controller(db=db, skip=skip, limit=limit)


@router.get("/{id}", response_model=AIModelResponse, status_code=status.HTTP_200_OK)
def get_model(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_ai_model_by_id_controller(db=db, model_id=id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    controller.delete_ai_model_controller(db=db, model_id=id)
