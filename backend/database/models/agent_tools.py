from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.types import Uuid

from .base import Base


agent_tools = Table(
    "agent_tools",
    Base.metadata,
    Column(
        "agent_id",
        Uuid,
        ForeignKey("agents.id"),
        primary_key=True,
    ),
    Column(
        "tool_id",
        Uuid,
        ForeignKey("tools.id"),
        primary_key=True,
    ),
)
