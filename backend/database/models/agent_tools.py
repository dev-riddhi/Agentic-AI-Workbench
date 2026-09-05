from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base


class AgentTool(Base):
    """Maps an agent to an assigned tool name string."""

    __tablename__ = "agent_tools"

    agent_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("agents.id"),
        primary_key=True,
    )
    tool_name: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
    )

    agent = relationship("Agent", back_populates="agent_tools")


agent_tools = AgentTool.__table__
