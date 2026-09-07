from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database.models import Agent, AgentTrigger, Document, AgentTool, Runtime


def get_agents(
    db: Session,
    owner_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Agent]:
    statement = (
        select(Agent)
        .options(
            selectinload(Agent.agent_tools),
            selectinload(Agent.documents),
            selectinload(Agent.ai_model),
            # selectinload(Agent.runtime_instances),
        )
        .offset(skip)
        .limit(limit)
        .order_by(Agent.created_at.desc())
    )
    if owner_id:
        statement = statement.where(Agent.owner_id == owner_id)
    return list(db.scalars(statement).all())


def get_agent(db: Session, agent_id: UUID) -> Agent | None:
    statement = (
        select(Agent)
        .options(
            selectinload(Agent.agent_tools),
            selectinload(Agent.documents),
            selectinload(Agent.ai_model),
            # selectinload(Agent.runtime_instances),
        )
        .where(Agent.id == agent_id)
    )
    return db.scalar(statement)


def resolve_tools(db: Session | None = None, identifiers: list[str] | None = None) -> list[str]:
    """Returns list of clean tool name strings."""
    if not identifiers:
        return []
    return [ident.strip() for ident in identifiers if ident and ident.strip()]


def resolve_documents(db: Session, doc_ids: list[UUID]) -> list[Document]:
    if not doc_ids:
        return []
    statement = select(Document).where(Document.id.in_(doc_ids))
    return list(db.scalars(statement).all())


def create_agent(
    db: Session,
    owner_id: UUID,
    name: str,
    description: str | None,
    instructions: str,
    model_id: UUID,
    model_name: str | None = None,
    trigger: AgentTrigger = AgentTrigger.MANUAL,
    schedule: str | None = None,
    max_execution_time: int = 10,
    max_tool_calls: int = 50,
    concurrency: int = 1,
    retries: int = 3,
    tools: list[str] | None = None,
    documents: list[Document] | None = None,
) -> Agent:
    agent = Agent(
        owner_id=owner_id,
        name=name,
        description=description,
        instructions=instructions,
        model_id=model_id,
        model=model_name,
        trigger=trigger,
        schedule=schedule,
        max_execution_time=max_execution_time,
        max_tool_calls=max_tool_calls,
        concurrency=concurrency,
        retries=retries,
    )
    if tools:
        agent.tools = tools
    if documents:
        agent.documents = documents

    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def update_agent(
    db: Session,
    agent: Agent,
    name: str | None = None,
    description: str | None = None,
    instructions: str | None = None,
    model_id: UUID | None = None,
    model_name: str | None = None,
    trigger: AgentTrigger | None = None,
    schedule: str | None = None,
    max_execution_time: int | None = None,
    max_tool_calls: int | None = None,
    concurrency: int | None = None,
    retries: int | None = None,
    tools: list[str] | None = None,
    documents: list[Document] | None = None,
) -> Agent:
    if name is not None:
        agent.name = name
    if description is not None:
        agent.description = description
    if instructions is not None:
        agent.instructions = instructions
    if model_id is not None:
        agent.model_id = model_id
    if model_name is not None:
        agent.model = model_name
    if trigger is not None:
        agent.trigger = trigger
    if schedule is not None:
        agent.schedule = schedule
    if max_execution_time is not None:
        agent.max_execution_time = max_execution_time
    if max_tool_calls is not None:
        agent.max_tool_calls = max_tool_calls
    if concurrency is not None:
        agent.concurrency = concurrency
    if retries is not None:
        agent.retries = retries
    if tools is not None:
        agent.tools = tools
    if documents is not None:
        agent.documents = documents

    agent.updated_at = datetime.now()

    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def delete_agent(db: Session, agent: Agent) -> None:
    db.delete(agent)
    db.commit()


def set_agent_running(
    db: Session,
    agent_id: UUID,
    is_running: bool = True,
) -> Agent | None:
    agent = db.scalar(select(Agent).where(Agent.id == agent_id))
    if not agent:
        return None
    if is_running:
        active_rt = db.scalar(select(Runtime).where(Runtime.agent_id == agent_id, Runtime.status == "running"))
        if not active_rt:
            rt = Runtime(agent_id=agent_id, status="running")
            db.add(rt)
            db.commit()
    else:
        set_agent_stopped(db, agent_id)
    return agent


def set_agent_stopped(db: Session, agent_id: UUID) -> bool:
    statement = select(Runtime).where(Runtime.agent_id == agent_id)
    runtimes = list(db.scalars(statement).all())
    for r in runtimes:
        db.delete(r)
    db.commit()
    return True


def get_running_agents(
    db: Session,
) -> list[Agent]:
    statement = (
        select(Agent)
        .join(Runtime, Runtime.agent_id == Agent.id)
        .where(Runtime.status == "running")
        .options(
            selectinload(Agent.agent_tools),
            selectinload(Agent.documents),
            selectinload(Agent.ai_model),
            # selectinload(Agent.runtime_instances),
        )
        .distinct()
    )
    return list(db.scalars(statement).all())


def create_runtime_instance(
    db: Session,
    agent_id: UUID,
    status: str = "running",
    thread_name: str | None = None,
    configuration: str | None = None,
) -> Runtime:
    runtime = Runtime(
        agent_id=agent_id,
        status=status,
        thread_name=thread_name,
        configuration=configuration,
        started_at=datetime.utcnow(),
        last_heartbeat=datetime.utcnow(),
    )
    db.add(runtime)
    db.commit()
    db.refresh(runtime)
    return runtime


def update_runtime_heartbeat(
    db: Session,
    agent_id: UUID,
) -> None:
    statement = select(Runtime).where(Runtime.agent_id == agent_id, Runtime.status == "running")
    runtimes = list(db.scalars(statement).all())
    for r in runtimes:
        r.last_heartbeat = datetime.utcnow()
    db.commit()


def stop_runtime_instance(
    db: Session,
    agent_id: UUID,
) -> bool:
    statement = select(Runtime).where(Runtime.agent_id == agent_id)
    runtimes = list(db.scalars(statement).all())
    for r in runtimes:
        db.delete(r)
    db.commit()
    return True


def get_active_runtimes(
    db: Session,
) -> list[Runtime]:
    statement = (
        select(Runtime)
        .options(selectinload(Runtime.agent))
        .where(Runtime.status == "running")
        .order_by(Runtime.started_at.desc())
    )
    return list(db.scalars(statement).all())


