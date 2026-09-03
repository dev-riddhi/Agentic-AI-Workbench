from datetime import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.features.ai_model.schemas import AIModelResponse


class ToolResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    handler: str

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    id: UUID
    name: str
    file_path: str
    mime_type: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RunningAgentResponse(BaseModel):
    id: UUID
    agent_id: UUID
    status: str
    auto_restart: bool
    started_at: datetime
    last_heartbeat: datetime
    configuration: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AgentBase(BaseModel):
    name: str
    description: str | None = None
    instructions: str = Field(
        ...,
        validation_alias=AliasChoices("instructions", "system_instructions"),
    )
    model_id: UUID = Field(
        ...,
        validation_alias=AliasChoices("model_id", "ai_model_id"),
    )


class AgentCreate(AgentBase):
    tools: list[str] = []
    document_ids: list[UUID] = []


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = Field(
        None,
        validation_alias=AliasChoices("instructions", "system_instructions"),
    )
    model_id: UUID | None = Field(
        None,
        validation_alias=AliasChoices("model_id", "ai_model_id"),
    )
    tools: list[str] | None = None
    document_ids: list[UUID] | None = None


class AgentResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    description: str | None = None
    instructions: str
    model_id: UUID
    model: str | None = None
    ai_model: AIModelResponse | None = None
    created_at: datetime
    updated_at: datetime
    tools: list[ToolResponse] = []
    documents: list[DocumentResponse] = []
    running_state: RunningAgentResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class AgentRunRequest(BaseModel):
    prompt: str
    conversation_id: UUID | None = None
    auto_restart: bool = True


class AgentRunResponse(BaseModel):
    execution_id: UUID
    agent_id: UUID
    status: str
    response: str
    tool_calls: list[dict] = []
    completed_at: datetime


class AgentStopRequest(BaseModel):
    execution_id: UUID | None = None


class AgentStopResponse(BaseModel):
    execution_id: UUID | None = None
    agent_id: UUID
    status: str = "stopped"
    message: str = "Agent execution stopped successfully"
    stopped_at: datetime
