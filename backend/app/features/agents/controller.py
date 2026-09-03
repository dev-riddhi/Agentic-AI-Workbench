from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.features.agents import model
from app.features.ai_model import model as ai_model_model
from app.features.agents.schemas import (
    AgentCreate,
    AgentRunRequest,
    AgentRunResponse,
    AgentStopRequest,
    AgentStopResponse,
    AgentUpdate,
)
from database.models import Agent, Document, RunningAgent


def get_agents_controller(
    db: Session,
    owner_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Agent]:
    return model.get_agents(db=db, owner_id=owner_id, skip=skip, limit=limit)


def get_agent_controller(db: Session, agent_id: UUID) -> Agent:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return agent


def create_agent_controller(
    db: Session,
    owner_id: UUID,
    agent_in: AgentCreate,
) -> Agent:
    ai_model = ai_model_model.get_ai_model_by_id(db=db, model_id=agent_in.model_id)
    if not ai_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI Model with id '{agent_in.model_id}' not found",
        )

    tools = model.resolve_tools(db=db, identifiers=agent_in.tools)
    documents = model.resolve_documents(db=db, doc_ids=agent_in.document_ids)

    return model.create_agent(
        db=db,
        owner_id=owner_id,
        name=agent_in.name,
        description=agent_in.description,
        instructions=agent_in.instructions,
        model_id=ai_model.id,
        model_name=ai_model.name,
        tools=tools,
        documents=documents,
    )


def update_agent_controller(
    db: Session,
    agent_id: UUID,
    agent_in: AgentUpdate,
) -> Agent:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    model_name = None
    if agent_in.model_id is not None:
        ai_model = ai_model_model.get_ai_model_by_id(db=db, model_id=agent_in.model_id)
        if not ai_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"AI Model with id '{agent_in.model_id}' not found",
            )
        model_name = ai_model.name

    tools = (
        model.resolve_tools(db=db, identifiers=agent_in.tools)
        if agent_in.tools is not None
        else None
    )
    documents = (
        model.resolve_documents(db=db, doc_ids=agent_in.document_ids)
        if agent_in.document_ids is not None
        else None
    )

    return model.update_agent(
        db=db,
        agent=agent,
        name=agent_in.name,
        description=agent_in.description,
        instructions=agent_in.instructions,
        model_id=agent_in.model_id,
        model_name=model_name,
        tools=tools,
        documents=documents,
    )


def delete_agent_controller(db: Session, agent_id: UUID) -> None:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    model.set_agent_stopped(db=db, agent_id=agent_id)
    model.delete_agent(db=db, agent=agent)


def run_agent_controller(
    db: Session,
    agent_id: UUID,
    run_in: AgentRunRequest,
) -> AgentRunResponse:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    # Persist running state for auto-restart on system recovery
    model.set_agent_running(
        db=db,
        agent_id=agent.id,
        status="running",
        auto_restart=run_in.auto_restart,
        configuration=f'{{"prompt": "{run_in.prompt}"}}',
    )

    # Execution stub per instructions
    return AgentRunResponse(
        execution_id=uuid4(),
        agent_id=agent.id,
        status="completed",
        response=f"Agent '{agent.name}' completed execution for prompt: {run_in.prompt}",
        tool_calls=[],
        completed_at=datetime.now(timezone.utc),
    )


def stop_agent_controller(
    db: Session,
    agent_id: UUID,
    stop_in: AgentStopRequest | None = None,
) -> AgentStopResponse:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    # Remove running state from running_agents table
    model.set_agent_stopped(db=db, agent_id=agent.id)

    exec_id = stop_in.execution_id if stop_in and stop_in.execution_id else uuid4()

    return AgentStopResponse(
        execution_id=exec_id,
        agent_id=agent.id,
        status="stopped",
        message=f"Execution for agent '{agent.name}' stopped successfully",
        stopped_at=datetime.now(timezone.utc),
    )


def get_running_agents_controller(
    db: Session,
    auto_restart_only: bool = False,
) -> list[RunningAgent]:
    return model.get_running_agents(db=db, auto_restart_only=auto_restart_only)


def get_agent_documents_controller(db: Session, agent_id: UUID) -> list[Document]:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return list(agent.documents)
