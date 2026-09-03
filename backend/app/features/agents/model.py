from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database.models import Agent, Document, RunningAgent, Tool


def get_agents(
    db: Session,
    owner_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Agent]:
    statement = (
        select(Agent)
        .options(
            selectinload(Agent.tools),
            selectinload(Agent.documents),
            selectinload(Agent.running_state),
            selectinload(Agent.ai_model),
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
            selectinload(Agent.tools),
            selectinload(Agent.documents),
            selectinload(Agent.running_state),
            selectinload(Agent.ai_model),
        )
        .where(Agent.id == agent_id)
    )
    return db.scalar(statement)


def resolve_tools(db: Session, identifiers: list[str]) -> list[Tool]:
    tools: list[Tool] = []
    for ident in identifiers:
        tool: Tool | None = None
        try:
            tool_uuid = UUID(ident)
            tool = db.scalar(select(Tool).where(Tool.id == tool_uuid))
        except (ValueError, AttributeError):
            pass

        if not tool:
            tool = db.scalar(select(Tool).where(Tool.name == ident))

        if not tool:
            tool = Tool(
                name=ident,
                description=f"Tool for {ident}",
                handler=f"default_{ident}",
            )
            db.add(tool)
            db.flush()

        tools.append(tool)
    return tools


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
    tools: list[Tool] | None = None,
    documents: list[Document] | None = None,
) -> Agent:
    agent = Agent(
        owner_id=owner_id,
        name=name,
        description=description,
        instructions=instructions,
        model_id=model_id,
        model=model_name,
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
    tools: list[Tool] | None = None,
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
    status: str = "running",
    auto_restart: bool = True,
    configuration: str | None = None,
) -> RunningAgent:
    statement = select(RunningAgent).where(RunningAgent.agent_id == agent_id)
    running_state = db.scalar(statement)
    if running_state:
        running_state.status = status
        running_state.auto_restart = auto_restart
        running_state.last_heartbeat = datetime.utcnow()
        if configuration is not None:
            running_state.configuration = configuration
    else:
        running_state = RunningAgent(
            agent_id=agent_id,
            status=status,
            auto_restart=auto_restart,
            configuration=configuration,
        )
        db.add(running_state)

    db.commit()
    db.refresh(running_state)
    return running_state


def set_agent_stopped(db: Session, agent_id: UUID) -> bool:
    statement = select(RunningAgent).where(RunningAgent.agent_id == agent_id)
    running_state = db.scalar(statement)
    if running_state:
        db.delete(running_state)
        db.commit()
        return True
    return False


def get_running_agents(
    db: Session,
    auto_restart_only: bool = False,
) -> list[RunningAgent]:
    statement = select(RunningAgent).where(RunningAgent.status == "running")
    if auto_restart_only:
        statement = statement.where(RunningAgent.auto_restart == True)
    return list(db.scalars(statement).all())


def get_running_state(db: Session, agent_id: UUID) -> RunningAgent | None:
    statement = select(RunningAgent).where(RunningAgent.agent_id == agent_id)
    return db.scalar(statement)
