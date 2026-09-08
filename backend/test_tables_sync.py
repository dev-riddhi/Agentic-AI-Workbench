"""Verification Test Suite for notifications & agent_actions database tables and sync."""

from datetime import datetime, timezone
import json
import os
import sqlite3
import sys
import time
from uuid import uuid4

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.database import SessionLocal, init_db
from database.models import Agent, AIModel, Notification, AgentAction, User
from app.features.notifications.manager import notification_manager
from app.runtime.agent_runtime import agent_runtime
from app.tools import system_notification


def test_tables_exist():
    print("\n[STEP 1] Verifying SQLite Table Schema Existence...")
    init_db()
    conn = sqlite3.connect("database/app.db")
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    conn.close()

    assert "notifications" in tables, f"'notifications' table missing from SQLite: {tables}"
    assert "agent_actions" in tables, f"'agent_actions' table missing from SQLite: {tables}"
    print("  ✅ 'notifications' table exists in database.")
    print("  ✅ 'agent_actions' table exists in database.")


def test_notification_sync_and_persistence():
    print("\n[STEP 2] Testing Notification DB Persistence & Sync...")
    unique_msg = f"Automated persistence test payload {uuid4()}"
    notif = system_notification(message=unique_msg, title="DB Sync Test", type="success")
    assert notif["success"] is True

    # 1. Verify in DB directly
    with SessionLocal() as db:
        row = db.query(Notification).filter(Notification.message == unique_msg).first()
        assert row is not None, "Notification row was not found in database"
        assert row.title == "DB Sync Test"
        assert row.type == "success"
        assert row.read is False
        notif_id = row.id
        print(f"  ✅ Notification persisted in DB: ID={notif_id}")

    # 2. Test get_recent from DB
    recent = notification_manager.get_recent(limit=10)
    assert any(str(r["id"]) == str(notif_id) for r in recent)
    print("  ✅ notification_manager.get_recent() retrieved persisted DB notification.")

    # 3. Test mark_read
    marked = notification_manager.mark_read(notif_id)
    assert marked is True
    with SessionLocal() as db:
        row = db.query(Notification).filter(Notification.id == notif_id).first()
        assert row.read is True
    print("  ✅ notification_manager.mark_read() updated row in DB to read=True.")

    # 4. Test mark_all_read
    system_notification(message="Unread #1", type="info")
    system_notification(message="Unread #2", type="warning")
    count = notification_manager.mark_all_read()
    assert count >= 2
    with SessionLocal() as db:
        unread_count = db.query(Notification).filter(Notification.read == False).count()  # noqa: E712
        assert unread_count == 0
    print(f"  ✅ notification_manager.mark_all_read() updated {count} unread notifications.")


def test_agent_actions_recording():
    print("\n[STEP 3] Testing Agent Final Output Recording in agent_actions Table...")
    with SessionLocal() as db:
        user = db.query(User).first()
        model_record = db.query(AIModel).first()
        if not user or not model_record:
            print("  ⚠️ Skipping: User or model fixture missing.")
            return

        agent_name = "Final Output Test Agent"
        agent = db.query(Agent).filter(Agent.name == agent_name).first()
        if not agent:
            agent = Agent(
                id=uuid4(),
                owner_id=user.id,
                name=agent_name,
                description="Tests recording final outputs into agent_actions",
                instructions="You are a test agent. Conclude with final answer.",
                model_id=model_record.id,
                model=getattr(model_record, "name", None) or "default",
                max_tool_calls=5,
                max_execution_time=2,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            agent.tools = ["read_file", "system_notification"]
            db.add(agent)
            db.commit()
            db.refresh(agent)
        else:
            agent.tools = ["read_file", "system_notification"]
            db.commit()
            db.refresh(agent)

    test_prompt = f"Run verification task at {datetime.now(timezone.utc).isoformat()}"
    expected_final_output = "FINAL ANSWER: All diagnostics completed with zero errors."

    def deterministic_model(messages, system_prompt, model_name=None):
        return expected_final_output

    exec_result = agent_runtime.execute_agent(
        agent_id=agent.id,
        initial_prompt=test_prompt,
        print_to_terminal=False,
        custom_model_caller=deterministic_model,
    )

    assert exec_result["success"] is True

    # Check agent_actions table in DB
    with SessionLocal() as db:
        action_row = (
            db.query(AgentAction)
            .filter(AgentAction.agent_id == agent.id)
            .order_by(AgentAction.created_at.desc())
            .first()
        )
        assert action_row is not None, "No agent_actions record found for agent!"
        assert action_row.prompt == test_prompt
        assert "All diagnostics completed with zero errors." in action_row.final_output
        assert action_row.status == "completed"
        assert action_row.execution_time_seconds is not None
        print(f"  ✅ Found recorded agent action in DB:")
        print(f"     • Action ID: {action_row.id}")
        print(f"     • Agent: {action_row.agent_name}")
        print(f"     • Status: {action_row.status}")
        print(f"     • Final Output: {action_row.final_output[:60]}...")
        print(f"     • Elapsed: {action_row.execution_time_seconds}s")


def test_agent_actions_controllers():
    print("\n[STEP 4] Testing Agent Actions Controllers & Endpoints...")
    from app.features.agents import controller
    with SessionLocal() as db:
        latest = controller.get_latest_agent_actions_controller(db=db, limit=5)
        assert len(latest) > 0, "Expected at least 1 latest agent action"
        first = latest[0]
        assert "final_output" in first
        assert "status" in first
        print(f"  ✅ get_latest_agent_actions_controller returned {len(latest)} records.")

        agent_id = first["agent_id"]
        if agent_id:
            specific = controller.get_agent_actions_controller(db=db, agent_id=agent_id, limit=5)
            assert len(specific) > 0
            print(f"  ✅ get_agent_actions_controller returned {len(specific)} records for agent {agent_id}.")


if __name__ == "__main__":
    print("=" * 75)
    print("  VERIFYING NOTIFICATIONS & AGENT_ACTIONS TABLES & FEATURE SYNC  ")
    print("=" * 75)
    test_tables_exist()
    test_notification_sync_and_persistence()
    test_agent_actions_recording()
    test_agent_actions_controllers()
    print("\n" + "=" * 75)
    print(" 🎉 ALL CHECKS PASSED: notifications & agent_actions ARE FULLY SYNCED! ")
    print("=" * 75 + "\n")
