import json
import time
import urllib.error
import urllib.request
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.features.agents import model as agent_model
from app.features.ai_model import controller as ai_model_controller
from app.features.runtime.schemas import (
    ActiveAgentRuntimeItem,
    AgentStartRequest,
    ModelStartRequest,
    ModelTestRequest,
    RuntimeOverviewResponse,
)
from app.runtime.model_runtime import model_runtime


def get_model_status():
    return model_runtime.get_status()


def start_model(req: ModelStartRequest):
    try:
        return model_runtime.start(
            model_identifier=req.model,
            host=req.host,
            port=req.port,
            ctx_size=req.ctx_size,
            n_gpu_layers=req.n_gpu_layers,
            threads=req.threads,
            wait_ready=req.wait_ready,
            timeout=req.timeout,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to start llama-server: {str(exc)}",
        )


def stop_model():
    return model_runtime.stop()


def get_model_logs(lines: int = 100):
    return {"logs": model_runtime.get_logs(lines=lines)}


def test_model(req: ModelTestRequest):
    runtime_status = model_runtime.get_status()
    if not runtime_status.get("running"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="llama-server is not running. Please start a model first.",
        )
    if not runtime_status.get("ready"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="llama-server is still loading weights into memory. Please retry in a few seconds.",
        )

    endpoint = f"http://{model_runtime.host}:{model_runtime.port}/v1/chat/completions"
    payload = {
        "messages": [
            {"role": "system", "content": "You are a helpful and concise local AI assistant."},
            {"role": "user", "content": req.prompt},
        ],
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
    }

    start_t = time.time()
    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        http_req = urllib.request.Request(
            endpoint,
            data=data_bytes,
            headers={"Content-Type": "application/json", "User-Agent": "Agentic-Workbench"},
            method="POST",
        )
        with urllib.request.urlopen(http_req, timeout=30.0) as resp:
            elapsed_ms = round((time.time() - start_t) * 1000, 2)
            res_json = json.loads(resp.read().decode("utf-8"))
            message_content = ""
            if "choices" in res_json and len(res_json["choices"]) > 0:
                choice = res_json["choices"][0]
                message_content = choice.get("message", {}).get("content", "")

            return {
                "success": True,
                "response": message_content,
                "latency_ms": elapsed_ms,
                "model": model_runtime.current_model_name,
                "usage": res_json.get("usage", {}),
            }
    except Exception as exc:
        elapsed_ms = round((time.time() - start_t) * 1000, 2)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Inference error from llama-server ({elapsed_ms}ms): {str(exc)}",
        )


def get_active_agents(db: Session) -> list[ActiveAgentRuntimeItem]:
    runtimes = agent_model.get_active_runtimes(db)
    items = []
    for r in runtimes:
        agent = r.agent
        agent_name = agent.name if agent else "Unknown Agent"
        agent_model_name = (
            agent.model
            if (agent and agent.model)
            else (agent.ai_model.name if (agent and agent.ai_model) else "Local Model")
        )
        items.append(
            ActiveAgentRuntimeItem(
                id=r.id,
                agent_id=r.agent_id,
                agent_name=agent_name,
                agent_model=agent_model_name,
                status=r.status,
                thread_name=r.thread_name,
                started_at=r.started_at,
                last_heartbeat=r.last_heartbeat,
            )
        )
    return items


def start_agent(db: Session, agent_id: UUID, req: AgentStartRequest | None = None):
    agent = agent_model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    agent_model.set_agent_running(db, agent_id, is_running=True)
    active_rts = get_active_agents(db)
    matched = next((item for item in active_rts if item.agent_id == agent_id), None)
    return {
        "success": True,
        "message": f"Agent '{agent.name}' started in runtime",
        "agent": matched,
    }


def stop_agent(db: Session, agent_id: UUID):
    agent = agent_model.get_agent(db=db, agent_id=agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    agent_model.set_agent_stopped(db, agent_id)
    return {
        "success": True,
        "message": f"Agent '{agent.name}' stopped in runtime",
    }


def get_runtime_overview(db: Session) -> RuntimeOverviewResponse:
    # Check llama installation
    llama_check = ai_model_controller.check_llama_server_and_get_models(db, limit=1)
    installed = llama_check.get("installed", False)
    server_path = llama_check.get("server_path")

    model_st = model_runtime.get_status()
    active_agents = get_active_agents(db)

    return RuntimeOverviewResponse(
        llama_installed=installed,
        llama_server_path=server_path,
        model_runtime=model_st,
        active_agents_count=len(active_agents),
        active_agents=active_agents,
    )
