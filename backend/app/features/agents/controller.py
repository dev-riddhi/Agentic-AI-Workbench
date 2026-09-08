from collections.abc import Generator
from datetime import datetime, timezone
import json
import logging
import queue
import threading
import time
from typing import Any
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
from app.runtime.agent_runtime import agent_runtime
from database.database import SessionLocal
from database.models import AgentTrigger, Agent, Document

logger = logging.getLogger(__name__)

def get_agents_controller(
    db: Session,
    owner_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Agent]:
    agents = model.get_agents(db=db, owner_id=owner_id, skip=skip, limit=limit)
    if not agents and owner_id is not None:
        return model.get_agents(db=db, owner_id=None, skip=skip, limit=limit)
    return agents


def get_agent_controller(db: Session, agent_id: UUID) -> Agent:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    # When visiting the specific agent, use its RuntimeThread to get accurate live status
    is_alive = agent_runtime.is_agent_executing(agent.id)
    if agent.is_running != is_alive:
        # agent.is_running = is_alive
        model.set_agent_running(db=db, agent_id=agent.id, is_running=is_alive)
    return agent


def get_agent_thread_status_controller(agent_id: UUID) -> dict[str, Any]:
    """Inspects the active or latest RuntimeThread for an agent."""
    return agent_runtime.get_agent_thread_status(agent_id)


def create_agent_controller(
    db: Session,
    owner_id: UUID,
    agent_in: AgentCreate,
) -> Agent:
    ai_model = ai_model_model.get_ai_model_by_id(db=db, model_id=agent_in.model_id)
    if not ai_model:
        first_model = db.query(ai_model_model.AIModel).first()
        if first_model:
            ai_model = first_model
        else:
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
        trigger=agent_in.trigger,
        schedule=agent_in.schedule,
        max_execution_time=agent_in.max_execution_time,
        max_tool_calls=agent_in.max_tool_calls,
        concurrency=agent_in.concurrency,
        retries=agent_in.retries,
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
    target_model_id = agent_in.model_id
    if target_model_id is not None:
        ai_model = ai_model_model.get_ai_model_by_id(db=db, model_id=target_model_id)
        if ai_model:
            model_name = ai_model.name
        else:
            first_model = db.query(ai_model_model.AIModel).first()
            if first_model:
                target_model_id = first_model.id
                model_name = first_model.name
            else:
                model_name = agent.model or "Local Model"

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
        model_id=target_model_id,
        model_name=model_name,
        trigger=agent_in.trigger,
        schedule=agent_in.schedule,
        max_execution_time=agent_in.max_execution_time,
        max_tool_calls=agent_in.max_tool_calls,
        concurrency=agent_in.concurrency,
        retries=agent_in.retries,
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

    # Mark agent as running
    model.set_agent_running(
        db=db,
        agent_id=agent.id,
        is_running=True,
    )

    
    exec_result = agent_runtime.execute_agent(agent_id=agent.id, initial_prompt=run_in.prompt)
    model.set_agent_running(db=db, agent_id=agent.id, is_running=False)

    return AgentRunResponse(
        execution_id=uuid4(),
        agent_id=agent.id,
        status="completed" if exec_result.get("success", True) else "failed",
        response=exec_result.get("response") or f"Agent '{agent.name}' completed execution.",
        tool_calls=exec_result.get("tool_calls", []),
        completed_at=datetime.now(timezone.utc),
    )


def run_agent_stream_controller(
    db: Session,
    agent_id: UUID,
    run_in: AgentRunRequest,
) -> Generator[str, None, None]:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    # Check if a RuntimeThread is already alive for this agent
    active_thread = agent_runtime.get_runtime_thread(agent.id)
    if active_thread and active_thread.is_alive:
        logger.warning(
            "Agent %s already has active RuntimeThread '%s' (thread_id: %s)",
            agent.id,
            active_thread.thread.name,
            active_thread.thread.ident,
        )
        yield f"data: {json.dumps({'type': 'error', 'error': f'Agent {agent.name} is already executing a task on worker thread {active_thread.thread.name}. Please wait or stop the active worker.'})}\n\n"
        yield "data: [DONE]\n\n"
        return


    # Mark agent as running in DB
    model.set_agent_running(db=db, agent_id=agent.id, is_running=True)

    event_queue: queue.Queue = queue.Queue()
    execution_done = threading.Event()
    cancel_event = threading.Event()

    def on_event(ev: dict[str, Any]):
        event_queue.put(ev)

    def worker():
        try:
            agent_runtime.execute_agent(
                agent_id=agent.id,
                initial_prompt=run_in.prompt,
                print_to_terminal=True,
                event_callback=on_event,
            )
        except Exception as exc:
            logger.error("Error in streaming agent worker for %s: %s", agent.id, exc)
            event_queue.put({"type": "error", "error": str(exc), "timestamp": datetime.now().isoformat()})
        finally:
            with SessionLocal() as worker_db:
                try:
                    model.set_agent_running(db=worker_db, agent_id=agent.id, is_running=False)
                except Exception:
                    pass
            execution_done.set()

    worker_thread = threading.Thread(
        target=worker,
        daemon=True,
        name=f"AgentStream-{agent.id}",
    )
    # Register RuntimeThread so visiting or checking the agent inspects this exact thread
    agent_runtime.register_runtime_thread(
        agent_id=agent.id,
        thread=worker_thread,
        cancel_event=cancel_event,
        task_prompt=run_in.prompt,
    )
    worker_thread.start()

    last_ping = time.time()
    try:
        while not execution_done.is_set() or not event_queue.empty():
            try:
                ev = event_queue.get(timeout=0.25)
                yield f"data: {json.dumps(ev, default=str)}\n\n"
            except queue.Empty:
                pass

            # Send SSE keep-alive heartbeat comment every 5 seconds to prevent browser/proxy timeouts
            now = time.time()
            if now - last_ping >= 5.0:
                yield ": keep-alive\n\n"
                last_ping = now

        yield "data: [DONE]\n\n"

    except GeneratorExit:
        logger.info("Client disconnected from SSE stream for agent %s. Cancelling RuntimeThread.", agent.id)
        agent_runtime.stop_agent_execution(agent.id)
        with SessionLocal() as stop_db:
            try:
                model.set_agent_running(db=stop_db, agent_id=agent.id, is_running=False)
                model.stop_runtime_instance(db=stop_db, agent_id=agent.id)
            except Exception:
                pass


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

    # Halt the RuntimeThread
    agent_runtime.stop_agent_execution(agent.id)

    # Mark agent as stopped
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
) -> list[Agent]:
    return model.get_running_agents(db=db)


def get_agent_documents_controller(db: Session, agent_id: UUID) -> list[Document]:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return list(agent.documents)


def get_available_tools_controller() -> list[dict[str, Any]]:
    from app.tools import TOOLS

    return [
        {
            "id": t["name"],
            "name": t["name"],
            "description": t.get("description", ""),
            "parameters": t.get("parameters", {}),
        }
        for t in TOOLS
    ]


def get_agent_actions_controller(
    db: Session,
    agent_id: UUID,
    limit: int = 50,
) -> list[dict[str, Any]]:
    agent = model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    actions = model.get_agent_actions(db=db, agent_id=agent_id, limit=limit)
    res = []
    for a in actions:
        t_calls = None
        if a.tool_calls:
            try:
                t_calls = json.loads(a.tool_calls) if isinstance(a.tool_calls, str) else a.tool_calls
            except Exception:
                t_calls = []
        res.append({
            "id": a.id,
            "agent_id": a.agent_id,
            "agent_name": a.agent_name,
            "execution_id": a.execution_id,
            "prompt": a.prompt,
            "final_output": a.final_output,
            "status": a.status,
            "tool_calls_count": a.tool_calls_count,
            "tool_calls": t_calls,
            "execution_time_seconds": a.execution_time_seconds,
            "created_at": a.created_at,
        })
    return res


def get_latest_agent_actions_controller(
    db: Session,
    limit: int = 50,
) -> list[dict[str, Any]]:
    actions = model.get_latest_agent_actions(db=db, limit=limit)
    res = []
    for a in actions:
        t_calls = None
        if a.tool_calls:
            try:
                t_calls = json.loads(a.tool_calls) if isinstance(a.tool_calls, str) else a.tool_calls
            except Exception:
                t_calls = []
        res.append({
            "id": a.id,
            "agent_id": a.agent_id,
            "agent_name": a.agent_name,
            "execution_id": a.execution_id,
            "prompt": a.prompt,
            "final_output": a.final_output,
            "status": a.status,
            "tool_calls_count": a.tool_calls_count,
            "tool_calls": t_calls,
            "execution_time_seconds": a.execution_time_seconds,
            "created_at": a.created_at,
        })
    return res
