"""Agent Runtime Module
Manages scheduled/triggered execution of agents, coordinating model calls,
parsing JSON tool calls, executing assigned tools, and feeding results back into the conversation history.
"""

from datetime import datetime, timezone
import json
import logging
import re
import sys
import threading
import time
from typing import Any
from uuid import UUID, uuid4

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

from app.features.agents import model
from app.runtime.schedule_parser import is_agent_due
from app.tools import TOOLS, TOOLS_MAP, run_tool
from database.database import SessionLocal
from database.models.agent import AgentTrigger

logger = logging.getLogger(__name__)


def build_accessible_tools(assigned_tool_names: list[str]) -> list[dict[str, Any]]:
    """Filters the global TOOLS registry to include only tools assigned to the agent."""
    assigned_set = set(assigned_tool_names or [])
    return [t for t in TOOLS if t.get("name") in assigned_set]


def build_system_prompt(agent_name: str, accessible_tools: list[dict[str, Any]]) -> str:
    """Constructs the system prompt instructing the agent on role, accessible tools,

    how to format JSON tool calls, and how to stop execution when finished.
    """
    tools_doc_list = []
    for t in accessible_tools:
        name = t.get("name", "")
        desc = t.get("description", "")
        params = t.get("parameters", {})
        tools_doc_list.append(
            f"- Tool: `{name}`\n"
            f"  Description: {desc}\n"
            f"  Parameters Schema: {json.dumps(params, indent=2)}"
        )

    tools_section = (
        "\n\n".join(tools_doc_list)
        if tools_doc_list
        else "No external tools assigned. Rely solely on your internal knowledge."
    )

    return (
        f"You are an autonomous AI agent named '{agent_name}'.\n"
        f"Your mission is to carry out your assigned instructions with precision, using the tools available to you.\n\n"
        f"=== ACCESSIBLE TOOLS ===\n"
        f"{tools_section}\n\n"
        f"=== HOW TO CALL TOOLS ===\n"
        f"When you need to execute a tool, your output MUST contain a JSON tool call block in one of the following formats:\n\n"
        f"```json\n"
        f"{{\n"
        f'  "action": "call_tool",\n'
        f'  "tool": "<tool_name>",\n'
        f'  "parameters": {{\n'
        f'    "<param_name>": <param_value>\n'
        f"  }}\n"
        f"}}\n"
        f"```\n"
        f"Or:\n"
        f"```json\n"
        f"{{\n"
        f'  "tool": "<tool_name>",\n'
        f'  "parameters": {{\n'
        f'    "<param_name>": <param_value>\n'
        f"  }}\n"
        f"}}\n"
        f"```\n\n"
        f"RULES FOR CALLING TOOLS:\n"
        f"1. You may ONLY call tools listed in the ACCESSIBLE TOOLS section above.\n"
        f"2. Ensure parameter names and types match the tool's parameter schema.\n"
        f"3. Issue ONE tool call at a time. After issuing a tool call, stop outputting and wait for the tool execution result in the conversation history.\n\n"
        f"=== HOW TO STOP EXECUTION (ON DONE) ===\n"
        f"When you have completed all tasks and satisfied the instructions, STOP calling tools and conclude execution.\n"
        f"You MUST signal completion using one of these two methods:\n"
        f"Method 1: Output a JSON completion block:\n"
        f"```json\n"
        f"{{\n"
        f'  "action": "done",\n'
        f'  "result": "<Detailed summary of actions taken, findings, or final answer>"\n'
        f"}}\n"
        f"```\n"
        f"Method 2: Start your final answer with 'FINAL ANSWER:' followed by your conclusion, without any tool call JSON.\n\n"
        f"Do NOT invoke any tools after your task is done."
    )


def extract_tool_call(response_text: str) -> tuple[str | None, dict[str, Any], bool, str | None]:
    """Parses model response to detect JSON tool calls or done signal.

    Returns:
        (tool_name, parameters, is_done, done_message)
    """
    if not response_text:
        return None, {}, False, None

    clean_text = response_text.strip()

    # Check for text completion keyword
    if "FINAL ANSWER:" in clean_text.upper():
        parts = re.split(r"FINAL ANSWER:", clean_text, flags=re.IGNORECASE)
        final_msg = parts[-1].strip() if len(parts) > 1 else clean_text
        return None, {}, True, final_msg

    parsed_candidates: list[dict[str, Any]] = []

    # 1. Direct JSON parse
    try:
        data = json.loads(clean_text)
        if isinstance(data, dict):
            parsed_candidates.append(data)
    except Exception:
        pass

    # 2. Markdown fenced code blocks: ```json ... ``` or ``` ... ```
    blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_text, flags=re.IGNORECASE)
    for block in blocks:
        try:
            data = json.loads(block.strip())
            if isinstance(data, dict):
                parsed_candidates.append(data)
        except Exception:
            pass

    # 3. Regex scan for JSON objects
    if not parsed_candidates:
        pattern = r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}"
        for match in re.finditer(pattern, clean_text):
            try:
                data = json.loads(match.group(0))
                if isinstance(data, dict):
                    parsed_candidates.append(data)
            except Exception:
                pass

    for candidate in parsed_candidates:
        action = str(candidate.get("action") or "").lower()
        if action == "done" or candidate.get("done") is True or candidate.get("status") == "done":
            result_msg = candidate.get("result") or candidate.get("message") or clean_text
            return None, {}, True, str(result_msg)

        tool_name = (
            candidate.get("tool")
            or candidate.get("tool_name")
            or candidate.get("name")
            or candidate.get("function")
        )
        if tool_name and isinstance(tool_name, str):
            raw_params = (
                candidate.get("parameters")
                or candidate.get("arguments")
                or candidate.get("args")
                or candidate.get("params")
            )
            if raw_params is None:
                raw_params = {
                    k: v
                    for k, v in candidate.items()
                    if k not in ("action", "tool", "tool_name", "name", "function")
                }

            if isinstance(raw_params, str):
                try:
                    params_dict = json.loads(raw_params)
                    if not isinstance(params_dict, dict):
                        params_dict = {"input": params_dict}
                except Exception:
                    params_dict = {"input": raw_params}
            elif isinstance(raw_params, dict):
                params_dict = raw_params
            else:
                params_dict = {}

            return tool_name.strip(), params_dict, False, None

    return None, {}, False, None


class RuntimeThread:
    """Stores a reference to a worker thread and its associated agent id.

    Used when visiting or running that agent to inspect its live status.
    """

    def __init__(
        self,
        agent_id: UUID | str,
        thread: threading.Thread,
        cancel_event: threading.Event | None = None,
        started_at: datetime | None = None,
        task_prompt: str | None = None,
    ):
        self.agent_id: str = str(agent_id)
        self.thread: threading.Thread = thread
        self.cancel_event: threading.Event = cancel_event or threading.Event()
        self.started_at: datetime = started_at or datetime.now()
        self.task_prompt: str | None = task_prompt
        self.stopped_at: datetime | None = None

    @property
    def is_alive(self) -> bool:
        return self.thread.is_alive()

    @property
    def status(self) -> str:
        if self.cancel_event.is_set():
            return "cancelling"
        return "running" if self.thread.is_alive() else "completed"

    def cancel(self) -> None:
        self.cancel_event.set()

    def mark_stopped(self) -> None:
        self.stopped_at = datetime.now()

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "thread_name": self.thread.name,
            "thread_ident": self.thread.ident,
            "is_alive": self.thread.is_alive(),
            "status": self.status,
            "started_at": self.started_at.isoformat(),
            "stopped_at": self.stopped_at.isoformat() if self.stopped_at else None,
            "task_prompt": self.task_prompt,
        }


class AgentRuntime:

    def __init__(self):
        self.running: bool = False
        self.runtime_thread: threading.Thread | None = None
        # List of RuntimeThread instances to track worker threads by agent id
        self.runtime_threads: list[RuntimeThread] = []
        self._thread_lock = threading.Lock()

    def register_runtime_thread(
        self,
        agent_id: UUID | str,
        thread: threading.Thread,
        cancel_event: threading.Event | None = None,
        task_prompt: str | None = None,
    ) -> RuntimeThread:
        """Stores a new RuntimeThread mapped to agent_id in the runtime_threads list."""
        rt_thread = RuntimeThread(
            agent_id=agent_id,
            thread=thread,
            cancel_event=cancel_event,
            task_prompt=task_prompt,
        )
        with self._thread_lock:
            self.runtime_threads.append(rt_thread)
            # Prune old completed threads if list grows large
            if len(self.runtime_threads) > 100:
                self.runtime_threads = [
                    rt for rt in self.runtime_threads if rt.is_alive
                ] + self.runtime_threads[-20:]
        logger.info(
            "Registered RuntimeThread '%s' for agent %s (thread_id: %s)",
            thread.name,
            agent_id,
            thread.ident,
        )
        return rt_thread

    def get_runtime_thread(self, agent_id: UUID | str) -> RuntimeThread | None:
        """Finds the active or most recent RuntimeThread for a specific agent id."""
        key = str(agent_id)
        with self._thread_lock:
            # First search for any currently alive thread for this agent
            for rt in reversed(self.runtime_threads):
                if rt.agent_id == key and rt.is_alive:
                    return rt
            # Fallback to the most recent thread record for this agent
            for rt in reversed(self.runtime_threads):
                if rt.agent_id == key:
                    return rt
        return None

    def get_agent_thread_status(self, agent_id: UUID | str) -> dict[str, Any]:
        """Gets runtime status of an agent using its tracked thread."""
        rt = self.get_runtime_thread(agent_id)
        if rt is None:
            return {
                "agent_id": str(agent_id),
                "is_running": False,
                "is_alive": False,
                "status": "idle",
                "thread_name": None,
                "started_at": None,
                "task_prompt": None,
            }
        return rt.to_dict()

    def is_agent_executing(self, agent_id: UUID | str) -> bool:
        """Returns True if the agent's thread is actively alive and executing."""
        rt = self.get_runtime_thread(agent_id)
        return bool(rt and rt.is_alive)

    def stop_agent_execution(self, agent_id: UUID | str) -> bool:
        """Signals active thread for the given agent to halt immediately."""
        key = str(agent_id)
        with self._thread_lock:
            stopped = False
            for rt in self.runtime_threads:
                if rt.agent_id == key and rt.is_alive:
                    rt.cancel()
                    stopped = True
            return stopped



    def start(self) -> bool:
        """Starts the Agent Runtime scheduler thread if not already running."""
        if self.running and self.runtime_thread is not None and self.runtime_thread.is_alive():
            logger.info("Agent Runtime is already running.")
            return True

        self.running = True
        self.runtime_thread = threading.Thread(
            target=self._run,
            name="agent-runtime",
            daemon=True,
        )
        self.runtime_thread.start()
        logger.info("Agent Runtime scheduler thread started.")
        return True

    def stop(self) -> bool:
        """Signals the Agent Runtime scheduler loop to stop."""
        self.running = False
        logger.info("Agent Runtime stop requested.")
        return True

    def is_alive(self) -> bool:
        """Checks if the runtime is marked running and its thread is currently alive."""
        return bool(self.running and self.runtime_thread is not None and self.runtime_thread.is_alive())

    def get_status(self, db=None) -> dict[str, Any]:
        """Returns current runtime status and active agent count."""
        scheduler_alive = bool(self.runtime_thread is not None and self.runtime_thread.is_alive())
        is_active = bool(self.running and scheduler_alive)

        active_count = 0
        try:
            if db is not None:
                active_count = len(model.get_active_runtimes(db))
            else:
                with SessionLocal() as session:
                    active_count = len(model.get_active_runtimes(session))
        except Exception as exc:
            logger.error("Error retrieving active runtimes count: %s", exc)

        return {
            "running": is_active,
            "scheduler_alive": scheduler_alive,
            "loop_interval_seconds": 60,
            "active_agents_count": active_count,
        }

    def _run(self):
        logger.info("Agent Runtime loop started")

        while self.running:
            try:
                self.check_triggers()
            except Exception as e:
                logger.error("Agent Runtime loop error: %s", e)

            # Responsive sleep so stopping happens immediately instead of waiting 60s
            for _ in range(60):
                if not self.running:
                    break
                time.sleep(1)

        logger.info("Agent Runtime loop exited cleanly.")

    def check_triggers(self):
        agents = self.get_due_agents()

        for agent in agents:
            logger.info("Triggering scheduled agent: %s (%s)", agent.name, agent.id)

            thread = threading.Thread(
                target=self.execute_agent,
                args=(agent.id,),
                name=f"agent-{agent.id}",
                daemon=True,
            )
            thread.start()

    def _get_llama_request_model(self):
        """Loads request_model from llama.cpp.py dynamically."""
        import importlib.util
        from pathlib import Path

        llama_file = Path(__file__).resolve().parent.parent / "llm" / "llama.cpp.py"
        if llama_file.exists():
            spec = importlib.util.spec_from_file_location("llama_cpp_client", llama_file)
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                return getattr(mod, "request_model", None)
        return None

    def _call_model(
        self,
        messages: list[dict[str, str]],
        system_prompt: str,
        model_name: str | None = None,
    ) -> str:
        """Invokes the model:
        If is_testing in settings table is True -> uses Gemini across the backend.
        If False -> uses llama.cpp.py to get running models and use them.
        """
        from app.features.settings.model import get_is_testing
        is_testing = get_is_testing()

        if is_testing:
            from app.llm import gemini
            gemini_model = getattr(gemini, "HARDCODED_MODEL", "gemini-2.5-flash")
            logger.info(
                "is_testing is True (from settings): routing agent model invocation to Gemini model '%s'",
                gemini_model,
            )
            resp = gemini.request_model(
                model=gemini_model,
                messages=messages,
                system_prompt=system_prompt,
                stream=False,
            )
        else:
            from app.llm import llama_cpp

            chosen_model = model_name
            try:
                running_models = llama_cpp.get_running_models()
            except Exception as exc:
                running_models = []
                logger.warning("Could not query running models from llama.cpp.py: %s", exc)

            if not chosen_model or chosen_model == "default" or (running_models and chosen_model not in running_models):
                if running_models:
                    chosen_model = running_models[0]
                else:
                    chosen_model = chosen_model or "default"

            logger.info("is_testing is False: calling llama.cpp.py model '%s' for agent invocation", chosen_model)

            llama_fn = self._get_llama_request_model()
            req_fn = llama_fn if llama_fn is not None else llama_cpp.request_model

            resp = req_fn(
                model=chosen_model,
                messages=messages,
                system_prompt=system_prompt,
                stream=False,
            )

        if isinstance(resp, str):
            return resp
        text_val = getattr(resp, "text", None)
        if text_val is not None:
            return str(text_val)
        choices = getattr(resp, "choices", None)
        if choices:
            msg = getattr(choices[0], "message", None)
            if msg is not None:
                content = getattr(msg, "content", "") or ""
                if not content and hasattr(msg, "reasoning_content"):
                    content = getattr(msg, "reasoning_content", "") or ""
                return str(content)
        return str(resp)

    def execute_agent(
        self,
        agent_id: UUID | str,
        initial_prompt: str | None = None,
        print_to_terminal: bool = True,
        custom_model_caller: Any = None,
        event_callback: Any = None,
    ) -> dict[str, Any]:
        """Executes an agent run lifecycle:

        1. Fetches agent instructions, accessible tools, and configuration.
        2. Constructs the system prompt and initial user context.
        3. Calls the model, parses JSON tool calls, executes tools, and feeds results
           back into history until the agent signals completion or limits are reached.
        4. Prints every task and step to terminal in real time.
        """
        if isinstance(agent_id, str):
            try:
                agent_id = UUID(agent_id)
            except ValueError:
                logger.error("Invalid agent UUID string: %s", agent_id)
                return {"success": False, "error": f"Invalid UUID: {agent_id}"}

        current_thread_name = threading.current_thread().name
        logger.info("Agent %s executing on thread %s", agent_id, current_thread_name)

        # 1. Fetch agent record and metadata
        with SessionLocal() as db:
            agent = model.get_agent(db=db, agent_id=agent_id)
            if not agent:
                logger.error("Agent %s not found in database. Aborting execution.", agent_id)
                return {"success": False, "error": f"Agent {agent_id} not found in database"}

            agent_name = agent.name
            instructions = agent.instructions or ""
            max_tool_calls = agent.max_tool_calls if (agent.max_tool_calls and agent.max_tool_calls > 0) else 50
            max_exec_minutes = agent.max_execution_time if (agent.max_execution_time and agent.max_execution_time > 0) else 10
            timeout_seconds = max_exec_minutes * 60

            # Check testing mode via settings table
            from app.features.settings.model import get_is_testing
            is_testing = get_is_testing(db=db)

            if is_testing:
                from app.llm import gemini
                target_model_name = getattr(gemini, "HARDCODED_MODEL", "gemini-2.5-flash")
                logger.info(
                    "is_testing is True: Agent '%s' (%s) will use Gemini model '%s'",
                    agent_name,
                    agent_id,
                    target_model_name,
                )
            else:
                from app.llm import llama_cpp
                try:
                    running_models = llama_cpp.get_running_models()
                except Exception:
                    running_models = []

                if running_models and (not agent.model or agent.model not in running_models):
                    target_model_name = running_models[0]
                else:
                    target_model_name = agent.model or (agent.ai_model.name if agent.ai_model else None)

            # Assigned tools and attached documents
            assigned_tool_names = list(agent.tools or [])
            document_snippets = []
            if agent.documents:
                for doc in agent.documents:
                    doc_title = doc.name or "Untitled"
                    doc_content = getattr(doc, "content", None) or getattr(doc, "summary", None) or ""
                    if doc_content:
                        document_snippets.append(f"Document '{doc_title}':\n{doc_content}")

        # 2. Build accessible tools & system prompt
        accessible_tools = build_accessible_tools(assigned_tool_names)
        accessible_tool_names = [t["name"] for t in accessible_tools]
        system_prompt = build_system_prompt(agent_name=agent_name, accessible_tools=accessible_tools)

        # 3. Build initial conversation prompt
        prompt_parts = []
        if instructions:
            prompt_parts.append(f"Agent Instructions:\n{instructions}")
        if initial_prompt:
            prompt_parts.append(f"Additional Task / Context:\n{initial_prompt}")
        if document_snippets:
            prompt_parts.append("Referenced Documents:\n" + "\n\n".join(document_snippets))
        prompt_parts.append(
            "Please begin executing the instructions. Call tools using the JSON format as necessary. "
            "When all goals are accomplished, conclude execution with a done signal or FINAL ANSWER."
        )
        initial_message = "\n\n".join(prompt_parts)

        history: list[dict[str, str]] = [
            {"role": "user", "content": initial_message}
        ]

        # 4. Register running instance in runtime table
        with SessionLocal() as db:
            try:
                model.create_runtime_instance(
                    db=db,
                    agent_id=agent_id,
                    status="running",
                    thread_name=current_thread_name,
                )
            except Exception as e:
                logger.error("Error registering agent %s in runtime table: %s", agent_id, e)

        provider_label = f"Google Gemini ({target_model_name})" if is_testing else f"llama.cpp ({target_model_name or 'local'})"

        def _emit_event(ev_data: dict[str, Any]):
            if event_callback is not None:
                try:
                    event_callback(ev_data)
                except Exception as _cb_err:
                    logger.warning("Event callback error: %s", _cb_err)

        _emit_event({
            "type": "agent_started",
            "agent_id": str(agent_id),
            "agent_name": agent_name,
            "provider": provider_label,
            "tools": accessible_tool_names,
            "prompt": initial_prompt,
            "timestamp": datetime.now().isoformat(),
        })

        if print_to_terminal:
            print(f"\n{'='*75}")
            print(f"🤖 [TASK: AGENT EXECUTION START] Agent: '{agent_name}'")
            print(f"🆔 ID: {agent_id} | Thread: {current_thread_name}")
            print(f"🎯 Model Provider: {provider_label}")
            print(f"🛠️ Accessible Tools ({len(accessible_tool_names)}): {accessible_tool_names or 'None'}")
            if instructions:
                instr_preview = instructions[:120] + "..." if len(instructions) > 120 else instructions
                print(f"📋 Instructions: {instr_preview}")
            if initial_prompt:
                print(f"📥 Input Prompt: {initial_prompt}")
            print(f"{'='*75}")

        start_time = time.time()
        tool_call_count = 0
        step_count = 0
        working = True
        final_answer = ""
        executed_tool_calls: list[dict[str, Any]] = []

        try:
            while working and self.running:
                rt = self.get_runtime_thread(agent_id)
                if rt and rt.cancel_event.is_set():
                    logger.info("Agent %s cancelled via RuntimeThread signal.", agent_id)
                    final_answer = "Execution halted by operator."
                    working = False
                    break

                step_count += 1


                # Check execution timeout
                if time.time() - start_time > timeout_seconds:
                    logger.warning("Agent %s reached maximum execution time (%s min). Stopping.", agent_id, max_exec_minutes)
                    if print_to_terminal:
                        print(f"⚠️ [TASK: TIMEOUT] Agent reached max time limit ({max_exec_minutes} min). Stopping.")
                    break

                # Check max tool calls
                if tool_call_count >= max_tool_calls:
                    logger.warning("Agent %s reached maximum tool calls limit (%s). Stopping.", agent_id, max_tool_calls)
                    if print_to_terminal:
                        print(f"⚠️ [TASK: LIMIT REACHED] Reached maximum tool calls limit ({max_tool_calls}). Stopping.")
                    break

                # Update heartbeat in database
                with SessionLocal() as db:
                    try:
                        model.update_runtime_heartbeat(db=db, agent_id=agent_id)
                    except Exception as e:
                        logger.debug("Failed to update runtime heartbeat for agent %s: %s", agent_id, e)

                _emit_event({
                    "type": "reasoning_step",
                    "step": step_count,
                    "agent_id": str(agent_id),
                    "status": "querying_model",
                    "timestamp": datetime.now().isoformat(),
                })

                if print_to_terminal:
                    print(f"\n--- [TASK: REASONING STEP #{step_count}] Querying Model Turn ---")

                # Call Model
                try:
                    if custom_model_caller is not None:
                        model_response_text = custom_model_caller(
                            messages=history,
                            system_prompt=system_prompt,
                            model_name=target_model_name,
                        )
                    else:
                        model_response_text = self._call_model(
                            messages=history,
                            system_prompt=system_prompt,
                            model_name=target_model_name,
                        )
                except Exception as exc:
                    logger.error("Model invocation failed for agent %s: %s", agent_id, exc)
                    _emit_event({
                        "type": "error",
                        "step": step_count,
                        "error": str(exc),
                        "timestamp": datetime.now().isoformat(),
                    })
                    if print_to_terminal:
                        print(f"❌ [TASK: MODEL ERROR] Invocation failed: {exc}")
                    final_answer = f"Error calling model: {exc}"
                    break

                logger.info("Agent %s model response (first 100 chars): %r", agent_id, model_response_text[:100])

                _emit_event({
                    "type": "model_output",
                    "step": step_count,
                    "content": model_response_text,
                    "timestamp": datetime.now().isoformat(),
                })

                if print_to_terminal:
                    print(f"💬 [TASK: MODEL OUTPUT]:\n{model_response_text.strip()}")

                # Append assistant turn to history
                history.append({
                    "role": "assistant",
                    "content": model_response_text,
                })

                # Parse model response for JSON tool call or done signal
                tool_name, tool_args, is_done, done_message = extract_tool_call(model_response_text)

                if is_done:
                    final_answer = done_message or model_response_text
                    logger.info("Agent %s signaled completion: %s", agent_id, final_answer)
                    if print_to_terminal:
                        print(f"\n🏁 [TASK: AGENT COMPLETED] Done signal detected!")
                        if final_answer:
                            print(f"📝 Final Summary / Answer:\n{final_answer}")
                    working = False
                    break

                if not tool_name:
                    # Model provided text response without tool calls; task concluded
                    final_answer = model_response_text
                    logger.info("Agent %s provided final response without tool calls. Concluding.", agent_id)
                    if print_to_terminal:
                        print(f"\n🏁 [TASK: TASK CONCLUDED] Direct answer returned without tool calls.")
                    working = False
                    break

                # Execute requested tool
                tool_call_count += 1
                logger.info(
                    "Agent %s invoking tool '%s' (call %d/%d) with args: %s",
                    agent_id,
                    tool_name,
                    tool_call_count,
                    max_tool_calls,
                    tool_args,
                )

                _emit_event({
                    "type": "tool_call",
                    "step": step_count,
                    "call_index": tool_call_count,
                    "tool": tool_name,
                    "arguments": tool_args,
                    "timestamp": datetime.now().isoformat(),
                })

                if print_to_terminal:
                    print(f"\n⚙️ [TASK: TOOL INVOCATION #{tool_call_count}] Tool: `{tool_name}`")
                    print(f"   Parameters: {json.dumps(tool_args, default=str)}")

                if tool_name not in accessible_tool_names:
                    tool_output = {
                        "success": False,
                        "error": (
                            f"Tool '{tool_name}' is not in your allowed tools list: {accessible_tool_names}. "
                            "Please use only accessible tools."
                        ),
                    }
                else:
                    try:
                        tool_output = run_tool(tool_name, **tool_args)
                    except Exception as exc:
                        logger.error("Exception executing tool '%s': %s", tool_name, exc)
                        tool_output = {
                            "success": False,
                            "error": f"Exception executing tool '{tool_name}': {str(exc)}",
                        }

                executed_tool_calls.append({
                    "name": tool_name,
                    "arguments": tool_args,
                    "result": tool_output,
                    "status": "success" if tool_output.get("success", True) else "failed",
                })

                # Feed tool result back to model with history
                tool_result_str = json.dumps(tool_output, default=str, indent=2)
                logger.info("Agent %s tool '%s' execution completed (result length: %d)", agent_id, tool_name, len(tool_result_str))

                _emit_event({
                    "type": "tool_result",
                    "step": step_count,
                    "call_index": tool_call_count,
                    "tool": tool_name,
                    "result": tool_output,
                    "status": "success" if tool_output.get("success", True) else "failed",
                    "timestamp": datetime.now().isoformat(),
                })

                if print_to_terminal:
                    res_status = "✅ SUCCESS" if tool_output.get("success", True) else "⚠️ FAILED"
                    print(f"📦 [TASK: TOOL RESULT - {res_status}]:\n{tool_result_str}")

                history.append({
                    "role": "user",
                    "content": (
                        f"Tool Execution Result for `{tool_name}`:\n"
                        f"{tool_result_str}\n\n"
                        "Review this tool output and proceed with next steps, or if finished, stop execution."
                    ),
                })

        finally:
            try:
                rt = self.get_runtime_thread(agent_id)
                if rt:
                    rt.mark_stopped()
            except Exception:
                pass

            # Deregister or update status in runtime table upon completion
            with SessionLocal() as db:
                try:
                    model.stop_runtime_instance(db=db, agent_id=agent_id)
                    logger.info("Agent %s runtime record cleared.", agent_id)
                    if print_to_terminal:
                        print(f"🧹 [TASK: RUNTIME DEREGISTRATION] Cleared active instance record from database.")
                except Exception as e:
                    logger.error("Error clearing runtime record for agent %s: %s", agent_id, e)

            # Record final output in agent_actions table
            try:
                with SessionLocal() as db:
                    from database.models.agent_action import AgentAction
                    action_record = AgentAction(
                        id=uuid4(),
                        agent_id=agent_id if isinstance(agent_id, UUID) else UUID(str(agent_id)),
                        agent_name=agent_name,
                        execution_id=str(uuid4()),
                        prompt=initial_prompt,
                        final_output=final_answer or "Execution concluded.",
                        status="completed" if ("Error calling model" not in (final_answer or "")) else "failed",
                        tool_calls_count=tool_call_count,
                        tool_calls=json.dumps(executed_tool_calls, default=str),
                        execution_time_seconds=round(time.time() - start_time, 2),
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(action_record)
                    db.commit()
                    logger.info("Recorded agent final output in agent_actions table (ID: %s)", action_record.id)
            except Exception as action_err:
                logger.error("Failed to record agent action for agent %s: %s", agent_id, action_err)


            if print_to_terminal:
                elapsed = round(time.time() - start_time, 2)
                print(f"{'='*75}")
                print(f"✨ [TASK: SUMMARY] Agent '{agent_name}' finished in {elapsed}s | Tool Calls: {tool_call_count} | Steps: {step_count}")
                print(f"{'='*75}\n")

            _emit_event({
                "type": "completed",
                "agent_id": str(agent_id),
                "agent_name": agent_name,
                "response": final_answer or "Execution concluded.",
                "tool_calls": executed_tool_calls,
                "tool_call_count": tool_call_count,
                "step_count": step_count,
                "elapsed_seconds": round(time.time() - start_time, 2),
                "timestamp": datetime.now().isoformat(),
            })

        return {
            "success": True,
            "agent_id": str(agent_id),
            "agent_name": agent_name,
            "response": final_answer or "Execution concluded.",
            "tool_calls": executed_tool_calls,
            "tool_call_count": tool_call_count,
            "elapsed_seconds": round(time.time() - start_time, 2),
        }

    def get_due_agents(self):
        due_agents = []
        with SessionLocal() as db:
            all_agents = model.get_agents(db=db)
            now = datetime.now()

            for agent in all_agents:
                # Only check scheduled or one-time agents that are not already active
                if agent.is_running:
                    continue

                if agent.trigger in (AgentTrigger.SCHEDULE, AgentTrigger.ONETIME):
                    if is_agent_due(agent.schedule, now=now):
                        due_agents.append(agent)

        return due_agents


# Singleton instance
agent_runtime = AgentRuntime()
try:
    agent_runtime.start()
except Exception as _exc:
    logger.error("Failed to auto-start agent runtime: %s", _exc)

__all__ = [
    "AgentRuntime",
    "agent_runtime",
    "build_accessible_tools",
    "build_system_prompt",
    "extract_tool_call",
]