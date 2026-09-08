"""Notification Manager Hub
Maintains persistent database notifications in the `notifications` table and
provides thread-safe Pub/Sub for broadcasting notifications in real-time via SSE.
"""

from collections import deque
from datetime import datetime, timezone
import json
import logging
import queue
import threading
from typing import Any
from uuid import UUID, uuid4

from database.database import SessionLocal
from database.models.notification import Notification

logger = logging.getLogger(__name__)


class NotificationManager:
    """Thread-safe notification hub synchronized with the `notifications` database table."""

    def __init__(self, max_history: int = 100):
        self._max_history = max_history
        self._history: deque[dict[str, Any]] = deque(maxlen=max_history)
        self._subscribers: set[queue.Queue] = set()
        self._lock = threading.Lock()

    def publish(
        self,
        message: str,
        title: str = "System Notification",
        type: str = "info",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Publishes a notification to DB, active SSE subscribers, and in-memory cache."""
        # Normalize notification type
        norm_type = str(type).lower().strip()
        if norm_type in ("warn", "warning"):
            resolved_type = "warning"
        elif norm_type in ("err", "error", "critical", "danger"):
            resolved_type = "error"
        elif norm_type in ("success", "ok", "done"):
            resolved_type = "success"
        else:
            resolved_type = "info"

        item_id = uuid4()
        now_utc = datetime.now(timezone.utc)
        safe_title = str(title).strip() or "System Notification"
        safe_message = str(message).strip()
        meta_dict = metadata or {}
        meta_json_str = json.dumps(meta_dict) if meta_dict else None

        # 1. Persist to database
        try:
            with SessionLocal() as db:
                db_notif = Notification(
                    id=item_id,
                    title=safe_title,
                    message=safe_message,
                    type=resolved_type,
                    read=False,
                    metadata_json=meta_json_str,
                    created_at=now_utc,
                )
                db.add(db_notif)
                db.commit()
        except Exception as e:
            logger.error("Failed to persist notification to database: %s", e)

        # 2. Build live broadcast payload
        notification_item: dict[str, Any] = {
            "id": str(item_id),
            "title": safe_title,
            "message": safe_message,
            "type": resolved_type,
            "read": False,
            "metadata": meta_dict,
            "timestamp": now_utc.isoformat(),
        }

        # 3. Broadcast to all active SSE subscribers
        with self._lock:
            self._history.appendleft(notification_item)
            dead_subscribers = []
            for q in self._subscribers:
                try:
                    q.put_nowait(notification_item)
                except queue.Full:
                    dead_subscribers.append(q)
                except Exception as e:
                    logger.debug("Failed to push to notification subscriber: %s", e)
                    dead_subscribers.append(q)

            for dead in dead_subscribers:
                self._subscribers.discard(dead)

        logger.info(
            "Published [%s] notification: '%s' - '%s' (DB Persisted, Subscribers: %d)",
            resolved_type.upper(),
            notification_item["title"],
            notification_item["message"][:60],
            len(self._subscribers),
        )

        return notification_item

    def subscribe(self) -> queue.Queue:
        """Registers and returns a thread-safe Queue for a subscriber to receive live notifications."""
        q: queue.Queue = queue.Queue(maxsize=100)
        with self._lock:
            self._subscribers.add(q)
        logger.debug("New notification subscriber connected. Total: %d", len(self._subscribers))
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        """Unregisters a subscriber Queue."""
        with self._lock:
            self._subscribers.discard(q)
        logger.debug("Notification subscriber disconnected. Remaining: %d", len(self._subscribers))

    def get_recent(self, limit: int = 50) -> list[dict[str, Any]]:
        """Returns recent notifications from the database (falling back to memory if DB error)."""
        try:
            with SessionLocal() as db:
                rows = (
                    db.query(Notification)
                    .order_by(Notification.created_at.desc())
                    .limit(limit)
                    .all()
                )
                return [
                    {
                        "id": str(r.id),
                        "title": r.title,
                        "message": r.message,
                        "type": r.type,
                        "read": bool(r.read),
                        "metadata": json.loads(r.metadata_json) if r.metadata_json else {},
                        "timestamp": (
                            r.created_at.isoformat()
                            if r.created_at
                            else datetime.now(timezone.utc).isoformat()
                        ),
                    }
                    for r in rows
                ]
        except Exception as exc:
            logger.warning("Failed to query notifications from DB, falling back to memory: %s", exc)
            with self._lock:
                return list(self._history)[:limit]

    def mark_read(self, notification_id: str | UUID) -> bool:
        """Marks a single notification as read in database and memory."""
        str_id = str(notification_id)
        found = False

        # Update in DB
        try:
            target_uuid = UUID(str_id) if isinstance(notification_id, str) else notification_id
            with SessionLocal() as db:
                row = db.query(Notification).filter(Notification.id == target_uuid).first()
                if row:
                    row.read = True
                    db.commit()
                    found = True
        except Exception as exc:
            logger.warning("Error marking notification %s as read in DB: %s", notification_id, exc)

        # Update in memory
        with self._lock:
            for item in self._history:
                if item.get("id") == str_id:
                    item["read"] = True
                    found = True

        return found

    def mark_all_read(self) -> int:
        """Marks all notifications as read in database and memory."""
        count = 0
        try:
            with SessionLocal() as db:
                count = (
                    db.query(Notification)
                    .filter(Notification.read == False)  # noqa: E712
                    .update({"read": True})
                )
                db.commit()
        except Exception as exc:
            logger.warning("Error marking all notifications as read in DB: %s", exc)

        with self._lock:
            for item in self._history:
                item["read"] = True

        return count

    def clear(self) -> None:
        """Clears all notification history from database and memory."""
        try:
            with SessionLocal() as db:
                db.query(Notification).delete()
                db.commit()
        except Exception as exc:
            logger.warning("Error clearing notifications from DB: %s", exc)

        with self._lock:
            self._history.clear()


# Global singleton instance
notification_manager = NotificationManager()
