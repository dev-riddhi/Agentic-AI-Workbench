from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.features.agent_outputs import controller
from app.features.agent_outputs.schemas import AgentOutputPreviewResponse, AgentOutputResponse
from app.features.user.controller import get_current_user
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/outputs")


@router.get("/", response_model=list[AgentOutputResponse], status_code=status.HTTP_200_OK)
def list_outputs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    agent_id: UUID | None = Query(default=None),
    output_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.list_outputs_controller(
        db=db,
        skip=skip,
        limit=limit,
        agent_id=agent_id,
        output_type=output_type,
        search=search,
    )


@router.get("/{id}", response_model=AgentOutputResponse, status_code=status.HTTP_200_OK)
def get_output(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_output_by_id_controller(db=db, output_id=id)


@router.get("/{id}/download")
def download_output(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    return controller.download_output_controller(db=db, output_id=id)


@router.get("/{id}/preview", response_model=AgentOutputPreviewResponse, status_code=status.HTTP_200_OK)
def preview_output(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.preview_output_controller(db=db, output_id=id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_output(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    controller.delete_output_controller(db=db, output_id=id)
