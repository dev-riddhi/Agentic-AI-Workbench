from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from . import associations
from .base import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid4,
    )

    owner_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    instructions: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    model_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("ai_models.id"),
        nullable=False,
        index=True,
    )

    model: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now(),
        onupdate=datetime.now(),
        nullable=False,
    )

    owner = relationship("User", back_populates="agents")
    conversations = relationship("Conversation", back_populates="agent")
    tools = relationship(
        "Tool",
        secondary=associations.agent_tools,
        back_populates="agents",
    )
    documents = relationship(
        "Document",
        secondary=associations.agent_documents,
        back_populates="agents",
    )
    running_state = relationship(
        "RunningAgent",
        back_populates="agent",
        uselist=False,
        cascade="all, delete-orphan",
    )
    ai_model = relationship("AIModel")
