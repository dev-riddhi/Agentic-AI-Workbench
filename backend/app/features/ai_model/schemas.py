from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class AIModelDownloadRequest(BaseModel):
    repo_id: str
    filename: str
    name: str | None = None
    quantization: str | None = None

    @field_validator("filename")
    @classmethod
    def validate_gguf_extension(cls, v: str) -> str:
        if not v.lower().endswith(".gguf"):
            raise ValueError("Only .gguf model files are supported")
        return v


class AIModelResponse(BaseModel):
    id: UUID
    name: str
    repo_id: str
    filename: str
    file_path: str
    format: str = "gguf"
    size_bytes: int | None = None
    quantization: str | None = None
    status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
