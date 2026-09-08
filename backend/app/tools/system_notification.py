"""Tool: System Notification
Dispatches a real-time notification alert to the frontend user interface,
showing an alert toast and registering it in the workbench notification center.
"""

import logging
from typing import Any

from app.features.notifications.manager import notification_manager

logger = logging.getLogger(__name__)


def system_notification(
    message: str,
    title: str = "Agent Notification",
    type: str = "info",
    level: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Displays a notification toast alert to the user in the frontend interface.

    Args:
        message: The notification body text to present to the user.
        title: Header/title for the notification (default: 'Agent Notification').
        type: Visual style of notification: 'info', 'success', 'warning', or 'error' (default: 'info').
        level: Optional alias for 'type' (e.g. 'warning', 'error', 'info').
        **kwargs: Additional metadata parameters.

    Returns:
        dict: Result containing 'success', 'notification_id', 'title', 'message', 'type', and 'timestamp'.
    """
    if not message or not str(message).strip():
        return {
            "success": False,
            "error": "Notification message cannot be empty.",
        }

    # Resolve notification type / level
    effective_type = level if (level and str(level).strip()) else type

    try:
        notification = notification_manager.publish(
            message=str(message).strip(),
            title=str(title).strip() or "Agent Notification",
            type=str(effective_type).strip(),
            metadata=kwargs,
        )

        return {
            "success": True,
            "notification_id": notification["id"],
            "title": notification["title"],
            "message": notification["message"],
            "type": notification["type"],
            "timestamp": notification["timestamp"],
            "displayed": True,
        }
    except Exception as exc:
        logger.error("Failed to publish system notification: %s", exc)
        return {
            "success": False,
            "error": f"Failed to dispatch notification: {str(exc)}",
        }


# Direct executable invocation handler
def run(**kwargs: Any) -> dict[str, Any]:
    return system_notification(**kwargs)
