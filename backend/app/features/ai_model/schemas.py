from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class AIModelDownloadRequest(BaseModel):
    repo_id: str
    filename: str | None = None
    name: str | None = None
    quantization: str | None = None

    @field_validator("filename")
    @classmethod
    def validate_gguf_extension(cls, v: str | None) -> str | None:
        if v is not None and v.strip():
            clean = v.strip()
            if not clean.lower().endswith(".gguf"):
                raise ValueError("Only .gguf model files are supported")
            return clean
        return None


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


class LlamaServerStatusResponse(BaseModel):
    installed: bool
    message: str
    server_path: str | None = None
    models: list[AIModelResponse] = []


class ModelRuntimeStartRequest(BaseModel):
    model: str  # Can be UUID, model name, or path to .gguf
    port: int = 8080
    host: str = "127.0.0.1"
    ctx_size: int = 4096
    n_gpu_layers: int = 99
    threads: int | None = None
    wait_ready: bool = True
    timeout: float = 30.0

