from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.features.runtime import controller
from app.features.runtime.schemas import (
    ActiveAgentRuntimeItem,
    AgentRuntimeStatusResponse,
    AgentStartRequest,
    ModelRuntimeStatusResponse,
    ModelStartRequest,
    ModelTestRequest,
    RuntimeOverviewResponse,
    RuntimeStatusResponse,
)
from app.features.user.controller import get_current_user, get_optional_current_user
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/runtime")


@router.get("/overview", response_model=RuntimeOverviewResponse, status_code=status.HTTP_200_OK)
def get_overview(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.get_runtime_overview(db=db)


@router.get("/status", response_model=RuntimeStatusResponse, status_code=status.HTTP_200_OK)
def get_runtime_status(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.get_runtime_status(db=db)


# -----------------------------------------------------------------------------
# Model Runtime Routes
# -----------------------------------------------------------------------------
@router.get("/models/status", response_model=ModelRuntimeStatusResponse, status_code=status.HTTP_200_OK)
def get_model_status(
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.get_model_status()


@router.post("/models/start", response_model=ModelRuntimeStatusResponse, status_code=status.HTTP_200_OK)
def start_model(
    req: ModelStartRequest,
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.start_model(req)


@router.post("/models/stop", response_model=ModelRuntimeStatusResponse, status_code=status.HTTP_200_OK)
def stop_model(
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.stop_model()


@router.get("/models/logs", status_code=status.HTTP_200_OK)
def get_model_logs(
    lines: int = 100,
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.get_model_logs(lines=lines)


@router.post("/models/test", status_code=status.HTTP_200_OK)
def test_model(
    req: ModelTestRequest,
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.test_model(req)


# -----------------------------------------------------------------------------
# Agent Runtime Routes
# -----------------------------------------------------------------------------
@router.get("/agents/status", response_model=AgentRuntimeStatusResponse, status_code=status.HTTP_200_OK)
def get_agent_runtime_status(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.get_agent_runtime_status(db=db)


@router.post("/agents/scheduler/start", response_model=AgentRuntimeStatusResponse, status_code=status.HTTP_200_OK)
@router.post("/agents/start-scheduler", response_model=AgentRuntimeStatusResponse, status_code=status.HTTP_200_OK)
def start_agent_scheduler(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.start_agent_scheduler(db=db)


@router.post("/agents/scheduler/stop", response_model=AgentRuntimeStatusResponse, status_code=status.HTTP_200_OK)
@router.post("/agents/stop-scheduler", response_model=AgentRuntimeStatusResponse, status_code=status.HTTP_200_OK)
def stop_agent_scheduler(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.stop_agent_scheduler(db=db)


@router.get("/agents", response_model=list[ActiveAgentRuntimeItem], status_code=status.HTTP_200_OK)
def get_active_agents(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.get_active_agents(db=db)


@router.post("/agents/{agent_id}/start", status_code=status.HTTP_200_OK)
def start_agent(
    agent_id: UUID,
    req: AgentStartRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.start_agent(db=db, agent_id=agent_id, req=req)


@router.post("/agents/{agent_id}/stop", status_code=status.HTTP_200_OK)
def stop_agent(
    agent_id: UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    return controller.stop_agent(db=db, agent_id=agent_id)

