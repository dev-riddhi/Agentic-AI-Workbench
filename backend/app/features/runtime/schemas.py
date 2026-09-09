from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ModelStartRequest(BaseModel):
    model: str
    port: int = 8080
    host: str = "127.0.0.1"
    ctx_size: int = 4096
    n_gpu_layers: int = 99
    threads: int | None = None
    n_cpu_moe: int | None = None
    mmap: bool | None = None
    mlock: bool = False
    cache_type_k: str | None = "turbo4"
    cache_type_v: str | None = "turbo3"
    wait_ready: bool = True
    timeout: float = 30.0


class ModelTestRequest(BaseModel):
    prompt: str = "Hello! Please introduce yourself briefly."
    max_tokens: int = 128
    temperature: float = 0.7


class AgentStartRequest(BaseModel):
    prompt: str = "Execute operational objective"


class ModelRuntimeStatusResponse(BaseModel):
    running: bool
    ready: bool
    pid: int | None = None
    model_path: str | None = None
    model_name: str | None = None
    host: str
    port: int
    ctx_size: int
    n_gpu_layers: int
    threads: int | None = None
    n_cpu_moe: int | None = None
    mmap: bool | None = None
    mlock: bool | None = None
    cache_type_k: str | None = None
    cache_type_v: str | None = None
    base_url: str
    health_url: str
    uptime_seconds: float | None = None


class ActiveAgentRuntimeItem(BaseModel):
    id: UUID
    agent_id: UUID
    agent_name: str
    agent_model: str | None = None
    status: str
    thread_name: str | None = None
    started_at: datetime
    last_heartbeat: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentRuntimeStatusResponse(BaseModel):
    running: bool
    scheduler_alive: bool
    loop_interval_seconds: int = 60
    active_agents_count: int
    active_agents: list[ActiveAgentRuntimeItem] = []


class RuntimeStatusResponse(BaseModel):
    model_runtime: ModelRuntimeStatusResponse
    agent_runtime: AgentRuntimeStatusResponse


class RuntimeOverviewResponse(BaseModel):
    llama_installed: bool
    llama_server_path: str | None = None
    model_runtime: ModelRuntimeStatusResponse
    agent_runtime: AgentRuntimeStatusResponse | None = None
    active_agents_count: int
    active_agents: list[ActiveAgentRuntimeItem]

