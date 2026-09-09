from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base


class AgentAction(Base):
    __tablename__ = "agent_actions"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid4,
    )

    agent_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    agent_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    execution_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    prompt: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    final_output: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="completed",
        nullable=False,
    )

    tool_calls_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    tool_calls: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    execution_time_seconds: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    agent = relationship(
        "Agent",
        back_populates="actions",
    )
