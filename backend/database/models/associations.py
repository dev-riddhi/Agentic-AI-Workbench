# app/models/associations.py

from sqlalchemy import ForeignKey, Table, Column
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


agent_documents = Table(
    "agent_documents",
    Base.metadata,
    Column(
        "agent_id",
        Uuid,
        ForeignKey("agents.id"),
        primary_key=True,
    ),
    Column(
        "document_id",
        Uuid,
        ForeignKey("documents.id"),
        primary_key=True,
    ),
)