# app/models/tool.py

from uuid import UUID, uuid4

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base


class Tool(Base):
    __tablename__ = "tools"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    handler: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    agents = relationship(
        "Agent",
        secondary="agent_tools",
        back_populates="tools",
    )