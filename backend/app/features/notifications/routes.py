"""Notification Endpoints
Provides real-time Server-Sent Events (SSE) streaming and REST endpoints
for dispatching and inspecting system notifications.
"""

from collections.abc import Generator
import json
import logging
import queue
import time
from typing import Any

from fastapi import APIRouter, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.features.notifications.manager import notification_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications")


class NotificationCreateRequest(BaseModel):
    message: str = Field(..., description="Notification body message.")
    title: str = Field(default="System Notification", description="Title header.")
    type: str = Field(
        default="info",
        description="Notification style/type: 'info', 'success', 'warning', 'error'.",
    )
    metadata: dict[str, Any] = Field(default_factory=dict, description="Optional extra payload.")


class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    type: str
    read: bool = False
    metadata: dict[str, Any]
    timestamp: str


@router.get("", response_model=list[NotificationResponse], status_code=status.HTTP_200_OK)
@router.get("/", response_model=list[NotificationResponse], status_code=status.HTTP_200_OK)
def get_recent_notifications(limit: int = 50) -> list[dict[str, Any]]:
    """Returns recent system notifications."""
    return notification_manager.get_recent(limit=limit)


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(payload: NotificationCreateRequest) -> dict[str, Any]:
    """Manually dispatches a system notification and broadcasts to all connected clients."""
    return notification_manager.publish(
        message=payload.message,
        title=payload.title,
        type=payload.type,
        metadata=payload.metadata,
    )


@router.patch("/{id}/read", status_code=status.HTTP_200_OK)
def mark_notification_as_read(id: str) -> dict[str, Any]:
    """Marks a single notification as read in database and memory."""
    success = notification_manager.mark_read(id)
    return {"success": success, "id": id}


@router.post("/mark-all-read", status_code=status.HTTP_200_OK)
def mark_all_notifications_as_read() -> dict[str, Any]:
    """Marks all notifications as read in database and memory."""
    count = notification_manager.mark_all_read()
    return {"success": True, "updated_count": count}


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def clear_notifications() -> None:
    """Clears recent notification history."""
    notification_manager.clear()


@router.get("/stream")
def stream_notifications() -> StreamingResponse:
    """Streams real-time notifications to the frontend via Server-Sent Events (SSE)."""

    def event_generator() -> Generator[str, None, None]:
        client_queue = notification_manager.subscribe()
        last_ping = time.time()
        try:
            # Yield initial connected event
            yield f"data: {json.dumps({'type': 'connected', 'timestamp': time.time()})}\n\n"

            while True:
                try:
                    notification = client_queue.get(timeout=2.0)
                    yield f"data: {json.dumps(notification)}\n\n"
                    last_ping = time.time()
                except queue.Empty:
                    pass

                # Keep-alive heartbeat comment every 15s to keep connections healthy
                now = time.time()
                if now - last_ping >= 15.0:
                    yield ": keep-alive\n\n"
                    last_ping = now
        except GeneratorExit:
            logger.debug("SSE client disconnected from notification stream.")
        except Exception as exc:
            logger.warning("Error in notification SSE stream: %s", exc)
        finally:
            notification_manager.unsubscribe(client_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
