from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.types import Uuid

from .base import Base


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
