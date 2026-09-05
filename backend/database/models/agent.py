from datetime import datetime
import enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .agent_documents import agent_documents
from .agent_tools import AgentTool
from .base import Base


class AgentTrigger(str, enum.Enum):
    MANUAL = "manual"
    SCHEDULE = "schedule"
    ONETIME = "onetime"


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

    trigger: Mapped[AgentTrigger] = mapped_column(
        Enum(
            AgentTrigger,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AgentTrigger.MANUAL,
        server_default=AgentTrigger.MANUAL.value,
        nullable=False,
    )

    schedule: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    max_execution_time: Mapped[int] = mapped_column(
        Integer,
        default=10,
        server_default="10",
        nullable=False,
    )

    max_tool_calls: Mapped[int] = mapped_column(
        Integer,
        default=50,
        server_default="50",
        nullable=False,
    )

    concurrency: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
    )

    retries: Mapped[int] = mapped_column(
        Integer,
        default=3,
        server_default="3",
        nullable=False,
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
    agent_tools = relationship(
        "AgentTool",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    documents = relationship(
        "Document",
        secondary=agent_documents,
        back_populates="agents",
    )
    ai_model = relationship("AIModel")

    @property
    def tools(self) -> list[str]:
        return [at.tool_name for at in (self.agent_tools or [])]

    @tools.setter
    def tools(self, tool_names: list) -> None:
        self.agent_tools = [
            at if isinstance(at, AgentTool) else AgentTool(tool_name=str(getattr(at, "name", at)))
            for at in (tool_names or [])
        ]

    @property
    def is_running(self) -> bool:
        instances = getattr(self, "runtime_instances", None)
        if not instances:
            return False
        return any(r.status == "running" for r in instances)

