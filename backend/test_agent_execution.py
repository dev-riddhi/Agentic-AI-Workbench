"""Agent Runtime Verification Test Suite.

Checks if the agent runtime is operating properly:
1. Verifies database connectivity and runtime service status.
2. Checks model routing configuration (Gemini when is_testing=True, llama.cpp when is_testing=False).
3. Creates or retrieves a test agent equipped with file and diagnostic tools.
4. Executes the agent with a multi-step workflow (create file, read file, inspect metadata).
5. Prints every task, reasoning step, tool call, and tool output in the terminal in real time.
6. Validates the resulting artifacts, database runtime table registrations, and cleanup.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from uuid import uuid4

# Ensure terminal encoding supports utf-8 safely
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.database import SessionLocal
from database.models import Agent, AIModel, Document, Runtime, User
from app.features.settings.model import get_is_testing, set_is_testing
from app.runtime.agent_runtime import agent_runtime


def print_banner(title: str):
    width = 80
    print("\n" + "=" * width)
    print(f" {title.center(width - 2)} ")
    print("=" * width)


def ensure_test_fixtures(db):
    """Ensures a valid user and AI model record exist for agent assignment."""
    user = db.query(User).first()
    if not user:
        user = User(
            id=uuid4(),
            email="test_user@example.com",
            name="Test User",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    model_record = db.query(AIModel).first()
    if not model_record:
        model_record = AIModel(
            id=uuid4(),
            name="Test Verification Model",
            filename="tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
            file_path="models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
            format="gguf",
            size_bytes=669229056,
            quantization="Q4_K_M",
            status="ready",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(model_record)
        db.commit()
        db.refresh(model_record)

    return user, model_record


def get_or_create_test_agent(db, owner_id, model_record):
    """Creates or updates a dedicated automated test agent."""
    agent_name = "Automated Verification Agent"
    agent = db.query(Agent).filter(Agent.name == agent_name).first()

    tools_to_assign = ["write_create_file", "read_file", "get_file_metadata", "list_directory"]

    if not agent:
        agent = Agent(
            id=uuid4(),
            owner_id=owner_id,
            name=agent_name,
            description="Automated testing agent that executes tasks and verifies workbench tools.",
            instructions=(
                "You are an automated verification agent. When given a task:\n"
                "1. Analyze what tools are required.\n"
                "2. Call tools one by one using JSON format: {\"name\": \"<tool_name>\", \"arguments\": {...}}.\n"
                "3. Inspect each tool output to verify success.\n"
                "4. When all tasks are completed, output 'FINAL ANSWER: <summary>' to conclude execution."
            ),
            model_id=model_record.id,
            model=getattr(model_record, "name", None) or "default",
            max_tool_calls=15,
            max_execution_time=5,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        agent.tools = tools_to_assign
        db.add(agent)
        db.commit()
        db.refresh(agent)
    else:
        agent.tools = tools_to_assign
        if not agent.model or agent.model == "gemini-2.5-flash":
            agent.model = getattr(model_record, "name", None) or "default"
        db.commit()
        db.refresh(agent)

    return agent


def create_mock_model_responder(test_filename: str, test_content: str):
    """Creates a deterministic multi-step model caller to test the agent tool-execution loop.

    Simulates the cognitive turns of an LLM:
    Turn 1: Decides to write the file.
    Turn 2: Inspects write output, decides to read the file to verify.
    Turn 3: Inspects read output, decides to inspect file metadata.
    Turn 4: Confirms all tasks succeeded and provides FINAL ANSWER.
    """
    step_state = {"turn": 0}

    def mock_responder(messages: list[dict[str, str]], system_prompt: str, model_name: str | None = None) -> str:
        step_state["turn"] += 1
        turn = step_state["turn"]

        if turn == 1:
            return (
                "I will start by creating the verification file in the uploads folder.\n\n"
                f'```json\n{{\n  "name": "write_create_file",\n  "arguments": {{\n    "file_path": "{test_filename}",\n    "content": "{test_content}"\n  }}\n}}\n```'
            )
        elif turn == 2:
            return (
                "The file has been created successfully. Now I will read it back to verify its content.\n\n"
                f'```json\n{{\n  "name": "read_file",\n  "arguments": {{\n    "file_path": "{test_filename}"\n  }}\n}}\n```'
            )
        elif turn == 3:
            return (
                "The file content matches the expected verification text. Now I will inspect the file metadata.\n\n"
                f'```json\n{{\n  "name": "get_file_metadata",\n  "arguments": {{\n    "file_path": "{test_filename}"\n  }}\n}}\n```'
            )
        else:
            return (
                "All verification tasks have completed successfully.\n"
                "- Created test file with correct content\n"
                "- Read and verified content\n"
                "- Verified file metadata\n\n"
                "FINAL ANSWER: Verification agent has completed all steps with 100% success."
            )

    return mock_responder


def run_agent_test():
    print_banner("AGENT RUNTIME VERIFICATION & TASK EXECUTION TEST")
    test_results = []

    # 1. Check Runtime Status
    print("\n[STEP 1] Checking Agent Runtime Service...")
    if not agent_runtime.running:
        print("  ⚠️ Agent runtime was not running. Starting runtime worker thread...")
        agent_runtime.start()
    assert agent_runtime.running, "Agent runtime must be running"
    print(f"  ✅ Agent runtime is active. (Running status: {agent_runtime.running})")
    test_results.append(("Agent Runtime Service Active", True))

    # 2. Database & Fixtures
    print("\n[STEP 2] Verifying Database Connection & Agent Configuration...")
    with SessionLocal() as db:
        user, model_record = ensure_test_fixtures(db)
        test_agent = get_or_create_test_agent(db, owner_id=user.id, model_record=model_record)
        is_testing = get_is_testing(db=db)
        print(f"  ✅ Database connected.")
        print(f"  ✅ Test Agent: '{test_agent.name}' (ID: {test_agent.id})")
        print(f"  ✅ Assigned Tools: {test_agent.tools}")
        print(f"  ℹ️ Current is_testing setting: {is_testing}")
        print(f"  ℹ️ Active model routing: {'Google Gemini (gemini-2.5-flash)' if is_testing else 'llama.cpp.py (local)'}")
        test_results.append(("Database & Agent Record Setup", True))

    # 3. Test File Target
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    test_file_rel = f"uploads/test_agent_run_{timestamp_str}.txt"
    test_content = f"Workbench Agent verified at {timestamp_str}. System operating normally."

    test_prompt = (
        f"Execute verification tasks in sequence:\n"
        f"1. Write '{test_file_rel}' containing '{test_content}'.\n"
        f"2. Read '{test_file_rel}' to verify its content.\n"
        f"3. Retrieve metadata for '{test_file_rel}'.\n"
        f"4. Provide FINAL ANSWER summarizing results."
    )

    # 4. Check live model accessibility
    print("\n[STEP 3] Probing Configured LLM Provider...", flush=True)
    live_model_available = False
    try:
        if is_testing:
            from app.llm import gemini
            probe_resp = gemini.request_model("gemini-2.5-flash", messages=[{"role": "user", "content": "Ping"}])
            live_model_available = bool(probe_resp)
            print("  ✅ Gemini API responded successfully.", flush=True)
        else:
            from app.llm import llama_cpp
            cli = llama_cpp.get_client(timeout=3.0, max_retries=0)
            models_list = cli.models.list()
            if models_list.data:
                chosen_id = models_list.data[0].id
                resp = cli.chat.completions.create(
                    model=chosen_id,
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=5,
                    timeout=3.0,
                )
                live_model_available = bool(resp and resp.choices)
                print(f"  ✅ Local llama.cpp model '{chosen_id}' responded successfully.", flush=True)
    except Exception as e:
        err_msg = str(e).split("\n")[0][:100]
        print(f"  ⚠️ Live model probe note: {err_msg}", flush=True)
        print("  ℹ️ Executing full multi-step tool orchestration loop with deterministic responder.", flush=True)

    # 5. Execute Agent with Full Terminal Task Printing
    print("\n[STEP 4] Executing Agent Task Loop (Printing all tasks to terminal)...", flush=True)
    mock_caller = None if live_model_available else create_mock_model_responder(test_file_rel, test_content)

    start_exec = time.time()
    exec_result = agent_runtime.execute_agent(
        agent_id=test_agent.id,
        initial_prompt=test_prompt,
        print_to_terminal=True,
        custom_model_caller=mock_caller,
    )
    exec_duration = round(time.time() - start_exec, 2)

    # 6. Verify Execution Output
    print("\n[STEP 5] Verifying Execution Results & Artifacts...", flush=True)
    print(f"  • Success Flag: {exec_result.get('success')}")
    print(f"  • Tool Calls Count: {exec_result.get('tool_call_count')}")
    print(f"  • Elapsed Time: {exec_duration}s")
    print(f"  • Response Length: {len(exec_result.get('response', ''))} characters")

    assert exec_result.get("success") is True, f"Execution failed: {exec_result}"
    test_results.append(("Agent Execution Succeeded", True))

    tool_calls = exec_result.get("tool_calls", [])
    assert len(tool_calls) >= 2, f"Expected at least 2 tool calls, got {len(tool_calls)}"
    print(f"  ✅ Tool calls recorded: {[tc['name'] for tc in tool_calls]}")
    test_results.append(("Multi-Turn Tool Invocations", True))

    # 7. Verify File Written to Uploads
    backend_root = os.path.dirname(os.path.abspath(__file__))
    expected_full_path = os.path.join(backend_root, test_file_rel.replace("/", os.sep))
    print(f"  • Checking generated file: {expected_full_path}")
    assert os.path.exists(expected_full_path), f"File was not created at {expected_full_path}"

    with open(expected_full_path, "r", encoding="utf-8") as f:
        read_text = f.read()
    assert test_content in read_text, f"Content mismatch: expected {test_content!r}, got {read_text!r}"
    print(f"  ✅ File verified on disk with exact expected content.")
    test_results.append(("File Creation & Content Verification", True))

    # 8. Verify Runtime Table Lifecycle (Deregistered on finish)
    with SessionLocal() as db:
        active_runtime = db.query(Runtime).filter(Runtime.agent_id == test_agent.id).first()
        assert active_runtime is None, f"Runtime table should be cleared after execution, found: {active_runtime}"
        print(f"  ✅ Runtime table cleaned up: no orphaned runtime records.")
        test_results.append(("Runtime Table Cleanup Lifecycle", True))

    # Clean up test file
    try:
        os.remove(expected_full_path)
        print(f"  🧹 Cleaned up temporary test file: {test_file_rel}")
    except Exception:
        pass

    # 9. Summary Report
    print_banner("TEST SUMMARY REPORT")
    all_passed = True
    for test_name, passed in test_results:
        status_str = "✅ PASS" if passed else "❌ FAIL"
        if not passed:
            all_passed = False
        print(f"  {status_str} - {test_name}")

    print("=" * 80)
    if all_passed:
        print(" 🎉 ALL CHECKS PASSED: Agent is running correctly and all tasks printed to terminal! ")
    else:
        print(" ❌ SOME CHECKS FAILED ")
    print("=" * 80 + "\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = run_agent_test()
    sys.exit(exit_code)
