from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.features.agents import controller
from app.features.agents.schemas import (
    AgentCreate,
    AgentResponse,
    AgentRunRequest,
    AgentRunResponse,
    AgentStopRequest,
    AgentStopResponse,
    AgentUpdate,
    AvailableToolResponse,
    DocumentResponse,
)
from app.features.user.controller import get_current_user
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/agents")


@router.get("/", response_model=list[AgentResponse], status_code=status.HTTP_200_OK)
def get_agents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_agents_controller(
        db=db,
        owner_id=current_user.id,
        skip=skip,
        limit=limit,
    )


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    agent_in: AgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.create_agent_controller(
        db=db,
        owner_id=current_user.id,
        agent_in=agent_in,
    )


@router.get("/running", response_model=list[AgentResponse], status_code=status.HTTP_200_OK)
def get_running_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_running_agents_controller(
        db=db,
    )


@router.get("/tools", response_model=list[AvailableToolResponse], status_code=status.HTTP_200_OK)
def get_available_tools(
    current_user: User = Depends(get_current_user),
):
    return controller.get_available_tools_controller()


@router.get("/{id}", response_model=AgentResponse, status_code=status.HTTP_200_OK)
def get_agent(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_agent_controller(db=db, agent_id=id)


@router.put("/{id}", response_model=AgentResponse, status_code=status.HTTP_200_OK)
@router.patch("/{id}", response_model=AgentResponse, status_code=status.HTTP_200_OK)
def update_agent(
    id: UUID,
    agent_in: AgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.update_agent_controller(
        db=db,
        agent_id=id,
        agent_in=agent_in,
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    controller.delete_agent_controller(db=db, agent_id=id)


@router.post("/{id}/run", response_model=AgentRunResponse, status_code=status.HTTP_200_OK)
def run_agent(
    id: UUID,
    run_in: AgentRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.run_agent_controller(
        db=db,
        agent_id=id,
        run_in=run_in,
    )


@router.post("/{id}/stop", response_model=AgentStopResponse, status_code=status.HTTP_200_OK)
def stop_agent(
    id: UUID,
    stop_in: AgentStopRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.stop_agent_controller(
        db=db,
        agent_id=id,
        stop_in=stop_in,
    )


@router.get("/{id}/documents", response_model=list[DocumentResponse], status_code=status.HTTP_200_OK)
def get_agent_documents(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_agent_documents_controller(db=db, agent_id=id)
