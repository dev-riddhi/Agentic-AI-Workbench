from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from database.models.agent_output import AgentOutput


def create_agent_output(
    db: Session,
    title: str,
    output_type: str = "file",
    agent_id: UUID | None = None,
    agent_name: str | None = None,
    execution_id: str | None = None,
    action_id: UUID | None = None,
    file_path: str | None = None,
    file_size: int | None = None,
    mime_type: str | None = None,
    content_preview: str | None = None,
) -> AgentOutput:
    output = AgentOutput(
        id=uuid4(),
        agent_id=agent_id,
        agent_name=agent_name,
        execution_id=execution_id,
        action_id=action_id,
        title=title,
        output_type=output_type,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        content_preview=content_preview,
        created_at=datetime.now(timezone.utc),
    )
    db.add(output)
    db.commit()
    db.refresh(output)
    return output


def get_agent_outputs(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    agent_id: UUID | None = None,
    output_type: str | None = None,
    search: str | None = None,
) -> Sequence[AgentOutput]:
    query = select(AgentOutput)

    if agent_id:
        query = query.where(AgentOutput.agent_id == agent_id)

    if output_type and output_type.lower() != "all":
        query = query.where(AgentOutput.output_type == output_type.lower())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                AgentOutput.title.ilike(term),
                AgentOutput.agent_name.ilike(term),
                AgentOutput.content_preview.ilike(term),
                AgentOutput.file_path.ilike(term),
            )
        )

    query = query.order_by(AgentOutput.created_at.desc()).offset(skip).limit(limit)
    return db.scalars(query).all()


def get_agent_output_by_id(db: Session, output_id: UUID) -> AgentOutput | None:
    return db.scalar(select(AgentOutput).where(AgentOutput.id == output_id))


def delete_agent_output(db: Session, output: AgentOutput) -> None:
    db.delete(output)
    db.commit()
