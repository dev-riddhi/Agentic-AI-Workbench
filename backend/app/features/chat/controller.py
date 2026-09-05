from collections.abc import Generator
from datetime import datetime, timezone
import json
import logging
import time
import urllib.error
import urllib.request
from uuid import UUID

from fastapi import HTTPException, status
from openai import OpenAI
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.features.chat.schemas import (
    ChatCreateRequest,
    ConversationResponse,
    ConversationSummary,
    SendMessageRequest,
)
from app.runtime.model_runtime import model_runtime
from database.database import SessionLocal
from database.models.ai_model import AIModel
from database.models.conversation import Conversation

logger = logging.getLogger(__name__)


def _ensure_model_running(model: AIModel) -> None:
    """Ensures that the model server is actively running and ready to accept inference requests."""
    runtime_status = model_runtime.get_status()
    is_matching_model = False
    if runtime_status.get("running"):
        curr_name = runtime_status.get("model_name")
        curr_path = str(runtime_status.get("model_path") or "")
        if (curr_name and curr_name == model.name) or (model.filename and model.filename in curr_path):
            is_matching_model = True

    if not runtime_status.get("running") or not is_matching_model:
        try:
            logger.info("Attempting auto-start for model %s (%s)", model.name, model.id)
            model_runtime.start(model_identifier=model.id, wait_ready=True, timeout=25.0)
            runtime_status = model_runtime.get_status()
        except Exception as exc:
            logger.warning("Could not auto-start model runtime: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    f"Model server for '{model.name}' is not running. "
                    "Please start the model from the Model Hub or Runtime dashboard."
                ),
            )

    if not runtime_status.get("ready"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="llama-server is still loading weights into memory. Please retry in a few seconds.",
        )


def _build_api_messages(messages: list[dict], system_prompt: str | None = None) -> list[dict]:
    """Prepares structured messages list including system prompt for llama-server."""
    api_messages = []
    sys_prompt = (
        system_prompt
        or "You are a helpful, knowledgeable, and concise local AI assistant."
    )
    api_messages.append({"role": "system", "content": sys_prompt})
    for m in messages:
        api_messages.append({
            "role": m.get("role", "user"),
            "content": m.get("content", ""),
        })
    return api_messages


def list_conversations_controller(
    db: Session,
    user_id: UUID,
    model_id: UUID | None = None,
) -> list[ConversationSummary]:
    query = select(Conversation).where(Conversation.user_id == user_id)
    if model_id is not None:
        query = query.where(Conversation.model_id == model_id)
    query = query.order_by(desc(Conversation.updated_at))

    rows = db.scalars(query).all()
    summaries: list[ConversationSummary] = []
    for conv in rows:
        msgs = conv.messages or []
        last_content = None
        if msgs:
            last_content = msgs[-1].get("content")
            if last_content and len(last_content) > 80:
                last_content = last_content[:77] + "..."

        summaries.append(
            ConversationSummary(
                id=conv.id,
                model_id=conv.model_id,
                model_name=conv.model.name if conv.model else None,
                title=conv.title or "New Conversation",
                message_count=len(msgs),
                last_message=last_content,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
            )
        )
    return summaries


def create_conversation_controller(
    db: Session,
    user_id: UUID,
    req: ChatCreateRequest,
) -> ConversationResponse:
    model = db.get(AIModel, req.model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI Model '{req.model_id}' was not found in the database.",
        )

    title = req.title.strip() if req.title and req.title.strip() else f"Chat with {model.name}"
    messages: list[dict] = []

    now_iso = datetime.now(timezone.utc).isoformat()
    if req.initial_message and req.initial_message.strip():
        messages.append({
            "role": "user",
            "content": req.initial_message.strip(),
            "timestamp": now_iso,
        })

    conv = Conversation(
        user_id=user_id,
        model_id=model.id,
        title=title,
        messages=messages,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return ConversationResponse(
        id=conv.id,
        user_id=conv.user_id,
        model_id=conv.model_id,
        model_name=model.name,
        agent_id=conv.agent_id,
        title=conv.title,
        messages=conv.messages or [],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


def get_conversation_controller(
    db: Session,
    user_id: UUID,
    conversation_id: UUID,
) -> ConversationResponse:
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )

    return ConversationResponse(
        id=conv.id,
        user_id=conv.user_id,
        model_id=conv.model_id,
        model_name=conv.model.name if conv.model else None,
        agent_id=conv.agent_id,
        title=conv.title or "Conversation",
        messages=conv.messages or [],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


def delete_conversation_controller(
    db: Session,
    user_id: UUID,
    conversation_id: UUID,
) -> dict:
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )

    db.delete(conv)
    db.commit()
    return {"success": True, "id": str(conversation_id)}


def send_message_controller(
    db: Session,
    user_id: UUID,
    conversation_id: UUID,
    req: SendMessageRequest,
) -> ConversationResponse:
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied.",
        )

    if not conv.model_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This conversation is not linked to an AI Model.",
        )

    model = db.get(AIModel, conv.model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The configured AI Model is no longer available.",
        )

    _ensure_model_running(model)

    user_text = req.message.strip()
    now_iso = datetime.now(timezone.utc).isoformat()
    current_messages = list(conv.messages or [])

    # Record user turn
    current_messages.append({
        "role": "user",
        "content": user_text,
        "timestamp": now_iso,
    })

    # Prepare payload for llama-server OpenAI API
    api_messages = _build_api_messages(current_messages, req.system_prompt)
    endpoint = f"http://{model_runtime.host}:{model_runtime.port}/v1/chat/completions"
    payload = {
        "messages": api_messages,
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
        with urllib.request.urlopen(http_req, timeout=60.0) as resp:
            elapsed_ms = round((time.time() - start_t) * 1000, 2)
            res_json = json.loads(resp.read().decode("utf-8"))
            assistant_content = ""
            if "choices" in res_json and len(res_json["choices"]) > 0:
                choice = res_json["choices"][0]
                assistant_content = choice.get("message", {}).get("content", "")
                if not assistant_content and choice.get("message", {}).get("reasoning_content"):
                    assistant_content = choice.get("message", {}).get("reasoning_content", "")

            # Record assistant turn
            current_messages.append({
                "role": "assistant",
                "content": assistant_content,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "latency_ms": elapsed_ms,
            })
    except urllib.error.URLError as exc:
        logger.error("Failed to query llama-server at %s: %s", endpoint, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Inference error communicating with llama-server: {exc}",
        )
    except Exception as exc:
        logger.error("Unexpected error in chat completion: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model inference failed: {exc}",
        )

    # Auto-title conversation if default
    if conv.title and (conv.title.startswith("Chat with ") or conv.title == "New Conversation"):
        snippet = user_text[:35].replace("\n", " ").strip()
        if len(user_text) > 35:
            snippet += "..."
        conv.title = snippet

    conv.messages = current_messages
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conv)

    return ConversationResponse(
        id=conv.id,
        user_id=conv.user_id,
        model_id=conv.model_id,
        model_name=model.name,
        agent_id=conv.agent_id,
        title=conv.title,
        messages=conv.messages or [],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


def stream_message_controller(
    user_id: UUID,
    conversation_id: UUID,
    req: SendMessageRequest,
) -> Generator[str, None, None]:
    """Streams chat tokens using Server-Sent Events (SSE).
    
    1. Validates user access and model runtime readiness.
    2. Persists the user turn to SQLite.
    3. Returns a generator yielding token chunks (`data: {"token": "..."}\\n\\n`).
    4. Upon completion or client abort, persists the accumulated assistant response.
    """
    with SessionLocal() as db:
        conv = db.get(Conversation, conversation_id)
        if not conv or conv.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or access denied.",
            )

        if not conv.model_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This conversation is not linked to an AI Model.",
            )

        model = db.get(AIModel, conv.model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The configured AI Model is no longer available.",
            )

        _ensure_model_running(model)

        user_text = req.message.strip()
        now_iso = datetime.now(timezone.utc).isoformat()
        current_messages = list(conv.messages or [])

        # Record user turn
        current_messages.append({
            "role": "user",
            "content": user_text,
            "timestamp": now_iso,
        })
        conv.messages = current_messages
        conv.updated_at = datetime.now(timezone.utc)
        db.commit()

        # Capture variables for stream closure
        model_name = model.name
        api_messages = _build_api_messages(current_messages, req.system_prompt)
        max_tokens = req.max_tokens
        temperature = req.temperature
        base_url = f"http://{model_runtime.host}:{model_runtime.port}/v1"

    def event_generator() -> Generator[str, None, None]:
        client = OpenAI(base_url=base_url, api_key="llama-cpp", timeout=120.0)
        accumulated_text = ""
        saved = False
        start_t = time.time()
        try:
            stream = client.chat.completions.create(
                model=model_name,
                messages=api_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            for chunk in stream:
                if not chunk.choices or len(chunk.choices) == 0:
                    continue
                delta = chunk.choices[0].delta
                token = delta.content or getattr(delta, "reasoning_content", None) or ""
                if token:
                    accumulated_text += token
                    yield f"data: {json.dumps({'token': token})}\n\n"

            # Stream finished naturally
            elapsed_ms = round((time.time() - start_t) * 1000, 2)
            with SessionLocal() as db:
                c = db.get(Conversation, conversation_id)
                if c:
                    msgs = list(c.messages or [])
                    msgs.append({
                        "role": "assistant",
                        "content": accumulated_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "latency_ms": elapsed_ms,
                    })
                    c.messages = msgs
                    c.updated_at = datetime.now(timezone.utc)
                    if c.title and (c.title.startswith("Chat with ") or c.title == "New Conversation"):
                        snippet = user_text[:35].replace("\n", " ").strip()
                        if len(user_text) > 35:
                            snippet += "..."
                        c.title = snippet
                    db.commit()
                    db.refresh(c)
                    saved = True

                    summary_payload = {
                        "done": True,
                        "conversation": {
                            "id": str(c.id),
                            "user_id": str(c.user_id),
                            "model_id": str(c.model_id) if c.model_id else None,
                            "model_name": model_name,
                            "agent_id": str(c.agent_id) if c.agent_id else None,
                            "title": c.title,
                            "messages": c.messages or [],
                            "created_at": c.created_at.isoformat() if c.created_at else None,
                            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                        },
                    }
                    yield f"data: {json.dumps(summary_payload)}\n\n"
                    yield "data: [DONE]\n\n"

        except GeneratorExit:
            logger.info("Client aborted chat stream early.")
            if not saved and accumulated_text:
                elapsed_ms = round((time.time() - start_t) * 1000, 2)
                try:
                    with SessionLocal() as db:
                        c = db.get(Conversation, conversation_id)
                        if c:
                            msgs = list(c.messages or [])
                            msgs.append({
                                "role": "assistant",
                                "content": accumulated_text,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "latency_ms": elapsed_ms,
                                "interrupted": True,
                            })
                            c.messages = msgs
                            c.updated_at = datetime.now(timezone.utc)
                            db.commit()
                except Exception as db_exc:
                    logger.error("Failed to save partial message on stream abort: %s", db_exc)
            raise
        except Exception as exc:
            logger.error("Error during streaming inference: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

    return event_generator()
