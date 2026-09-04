from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SettingsData(BaseModel):
    company_name: str = "Agentic AI Workbench"
    max_concurrent_agent_limit: int = Field(default=10, ge=1)
    api_url: str = "http://localhost:8000/api/v1"
    environment: str = "development"
    default_timeout_seconds: int = Field(default=60, ge=1)
    maintenance_mode: bool = False
    extra_values: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class SettingsUpdate(BaseModel):
    company_name: str | None = None
    max_concurrent_agent_limit: int | None = Field(default=None, ge=1)
    api_url: str | None = None
    environment: str | None = None
    default_timeout_seconds: int | None = Field(default=None, ge=1)
    maintenance_mode: bool | None = None
    extra_values: dict[str, Any] | None = None

    model_config = ConfigDict(extra="allow")


class SettingsResponse(BaseModel):
    id: UUID
    key: str
    data: SettingsData
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
