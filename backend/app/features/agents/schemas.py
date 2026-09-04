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


from database.models.agent import AgentTrigger


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
    trigger: AgentTrigger = Field(
        default=AgentTrigger.MANUAL,
        validation_alias=AliasChoices("trigger", "trigger_type"),
    )
    schedule: str | None = None
    max_execution_time: int = 10
    max_tool_calls: int = 50
    concurrency: int = 1
    retries: int = 3


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
    trigger: AgentTrigger | None = Field(
        None,
        validation_alias=AliasChoices("trigger", "trigger_type"),
    )
    schedule: str | None = None
    max_execution_time: int | None = None
    max_tool_calls: int | None = None
    concurrency: int | None = None
    retries: int | None = None
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
    trigger: AgentTrigger = AgentTrigger.MANUAL
    schedule: str | None = None
    max_execution_time: int = 10
    max_tool_calls: int = 50
    concurrency: int = 1
    retries: int = 3
    is_running: bool = False
    created_at: datetime
    updated_at: datetime
    tools: list[ToolResponse] = []
    documents: list[DocumentResponse] = []

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
