from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageItem(BaseModel):
    role: str = Field(..., description="Role of the sender (user, assistant, system)")
    content: str = Field(..., description="Text content of the message")
    timestamp: str | None = Field(None, description="ISO timestamp string")


class ChatCreateRequest(BaseModel):
    model_id: UUID = Field(..., description="UUID of the AI model to chat with")
    title: str | None = Field(None, max_length=255, description="Optional title for the conversation")
    initial_message: str | None = Field(None, description="Optional starting message from the user")
    system_prompt: str | None = Field(None, description="Optional system instruction for the model")


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Message text from the user")
    system_prompt: str | None = Field(None, description="System instructions override")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int = Field(1024, ge=1, le=8192, description="Max generated tokens")


class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    model_id: UUID | None = None
    model_name: str | None = None
    agent_id: UUID | None = None
    title: str | None = None
    messages: list[dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationSummary(BaseModel):
    id: UUID
    model_id: UUID | None = None
    model_name: str | None = None
    title: str | None = None
    message_count: int = 0
    last_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
