"""Test Suite for system_notification Tool and Real-time Notification Hub."""

import os
import sys
import time
from uuid import uuid4
from datetime import datetime, timezone

from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent if Path(__file__).resolve().parent.name == "test" else Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.tools import TOOLS, TOOLS_MAP, get_tool, run_tool, system_notification
from app.features.notifications.manager import notification_manager
from database.database import SessionLocal
from database.models import Agent, AIModel, User
from app.runtime.agent_runtime import agent_runtime


def test_tool_registry():
    print("\n[TEST 1] Verifying system_notification Registration in Tools...")
    assert "system_notification" in TOOLS_MAP, "system_notification must be in TOOLS_MAP"
    tool_fn = get_tool("system_notification")
    assert callable(tool_fn), "get_tool('system_notification') must return a callable"

    matched = [t for t in TOOLS if t["name"] == "system_notification"]
    assert len(matched) == 1, "Exactly one system_notification entry in TOOLS"
    params = matched[0]["parameters"]["properties"]
    assert "message" in params, "'message' parameter must be documented"
    assert "title" in params, "'title' parameter must be documented"
    assert "type" in params, "'type' parameter must be documented"
    print("  ✅ system_notification is properly registered in TOOLS and TOOLS_MAP.")


def test_direct_tool_execution():
    print("\n[TEST 2] Testing Direct Tool Invocations...")
    # 1. Standard Info Notification
    res_info = system_notification(message="System initialized successfully.", title="Health Check", type="info")
    assert res_info["success"] is True, f"Failed info notification: {res_info}"
    assert res_info["type"] == "info"
    assert res_info["title"] == "Health Check"
    assert res_info["displayed"] is True

    # 2. Warning Notification with level alias
    res_warn = run_tool("system_notification", message="High memory usage detected (88%)", title="Telemetry Alert", level="warning")
    assert res_warn["success"] is True, f"Failed warn notification: {res_warn}"
    assert res_warn["type"] == "warning"

    # 3. Success Notification
    res_succ = system_notification(message="Batch export completed (1,240 records)", title="Export Complete", type="success")
    assert res_succ["success"] is True
    assert res_succ["type"] == "success"

    # 4. Error Notification (testing 'err' alias normalization)
    res_err = system_notification(message="Connection timed out on proxy node 4", title="Network Warning", type="err")
    assert res_err["success"] is True
    assert res_err["type"] == "error"

    # 5. Empty message validation
    res_empty = system_notification(message="")
    assert res_empty["success"] is False
    assert "empty" in res_empty["error"].lower()

    print("  ✅ All direct invocations, alias normalizations, and validations passed.")


def test_notification_manager_hub():
    print("\n[TEST 3] Testing NotificationManager Hub & Subscriber Pub/Sub...")
    # Subscribe client queue
    subscriber_queue = notification_manager.subscribe()

    # Publish notification
    test_msg = f"Live SSE test packet at {time.time()}"
    published = notification_manager.publish(
        message=test_msg,
        title="Live Broadcast",
        type="warning",
        metadata={"priority": "high"},
    )

    # Receive from subscriber queue
    received = subscriber_queue.get(timeout=2.0)
    assert received["id"] == published["id"], "Subscriber must receive the published notification"
    assert received["message"] == test_msg
    assert received["type"] == "warning"

    # Unsubscribe
    notification_manager.unsubscribe(subscriber_queue)

    # Verify recent history
    recent = notification_manager.get_recent(limit=10)
    assert len(recent) > 0
    assert any(r["id"] == published["id"] for r in recent)
    print("  ✅ NotificationManager Pub/Sub and history buffer verified.")


def test_agent_execution_with_notification():
    print("\n[TEST 4] Testing Agent Execution Loop with system_notification Tool...")
    with SessionLocal() as db:
        user = db.query(User).first()
        model_record = db.query(AIModel).first()
        if not user or not model_record:
            print("  ⚠️ Skipping live DB agent execution check: user/model record missing.")
            return

        agent_name = "Notification Verification Agent"
        test_agent = db.query(Agent).filter(Agent.name == agent_name).first()
        if not test_agent:
            test_agent = Agent(
                id=uuid4(),
                owner_id=user.id,
                name=agent_name,
                description="Agent that verifies frontend notifications.",
                instructions="When given a task, invoke system_notification tool and then conclude with FINAL ANSWER.",
                model_id=model_record.id,
                model=getattr(model_record, "name", None) or "default",
                max_tool_calls=5,
                max_execution_time=2,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            test_agent.tools = ["system_notification"]
            db.add(test_agent)
            db.commit()
            db.refresh(test_agent)
        else:
            test_agent.tools = ["system_notification"]
            db.commit()
            db.refresh(test_agent)

    # Deterministic multi-step responder simulating LLM calling system_notification
    step_state = {"turn": 0}

    def mock_notification_caller(messages, system_prompt, model_name=None):
        step_state["turn"] += 1
        turn = step_state["turn"]
        if turn == 1:
            return (
                'I will notify the operator that analysis is complete.\n\n'
                '```json\n'
                '{\n'
                '  "name": "system_notification",\n'
                '  "arguments": {\n'
                '    "title": "Anomaly Alert",\n'
                '    "message": "Hydraulic pressure sensor #3 returned abnormal reading (4,200 PSI).",\n'
                '    "type": "warning"\n'
                '  }\n'
                '}\n'
                '```'
            )
        else:
            return "FINAL ANSWER: Alert successfully sent to operator console."

    events_received = []

    def on_event(ev):
        events_received.append(ev)

    exec_res = agent_runtime.execute_agent(
        agent_id=test_agent.id,
        initial_prompt="Send an anomaly notification to the operator.",
        print_to_terminal=False,
        custom_model_caller=mock_notification_caller,
        event_callback=on_event,
    )

    assert exec_res["success"] is True, f"Agent execution failed: {exec_res}"
    assert exec_res["tool_call_count"] >= 1
    tool_calls = exec_res.get("tool_calls", [])
    assert any(tc["name"] == "system_notification" for tc in tool_calls)
    print("  ✅ Agent successfully invoked system_notification and concluded task.")


if __name__ == "__main__":
    print("=" * 70)
    print("   RUNNING SYSTEM_NOTIFICATION TOOL & HUB VERIFICATION SUITE   ")
    print("=" * 70)
    test_tool_registry()
    test_direct_tool_execution()
    test_notification_manager_hub()
    test_agent_execution_with_notification()
    print("\n" + "=" * 70)
    print(" 🎉 ALL TESTS PASSED: system_notification IS FULLY OPERATIONAL!")
    print("=" * 70 + "\n")
