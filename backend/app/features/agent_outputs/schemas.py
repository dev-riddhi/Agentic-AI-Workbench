from datetime import datetime
from uuid import UUID

from app.datetime_utils import UTCDateTime
from pydantic import BaseModel, ConfigDict


class AgentOutputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: UUID | None = None
    agent_name: str | None = None
    execution_id: str | None = None
    action_id: UUID | None = None
    title: str
    output_type: str
    file_path: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    content_preview: str | None = None
    created_at: UTCDateTime


class AgentOutputPreviewResponse(BaseModel):
    id: UUID
    title: str
    output_type: str
    file_path: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    content: str | None = None
    is_binary: bool = False
