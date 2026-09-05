from datetime import datetime
import threading
import time

from database.database import SessionLocal
from database.models.agent import AgentTrigger
from app.features.agents import model
from app.runtime.schedule_parser import is_agent_due


class AgentRuntime:

    def __init__(self):
        self.running = True
        self.runtime_thread = None

    def start(self):
        self.runtime_thread = threading.Thread(
            target=self._run,
            name="agent-runtime",
            daemon=True,
        )
        self.runtime_thread.start()

    def stop(self):
        self.running = False

    def _run(self):
        print("Agent Runtime started")

        while self.running:
            try:
                self.check_triggers()
            except Exception as e:
                print(f"Runtime error: {e}")

            time.sleep(60)

    def check_triggers(self):
        agents = self.get_due_agents()

        for agent in agents:
            print(f"Starting agent: {agent.name}")

            thread = threading.Thread(
                target=self.execute_agent,
                args=(agent.id,),
                name=f"agent-{agent.id}",
                daemon=True,
            )
            thread.start()

    def execute_agent(self, agent_id):
        current_thread_name = threading.current_thread().name
        print(f"Agent {agent_id} running on thread {current_thread_name}")

        working = True
        # Register running instance in the runtime table
        with SessionLocal() as db:
            try:
                model.create_runtime_instance(
                    db=db,
                    agent_id=agent_id,
                    status="running",
                    thread_name=current_thread_name,
                )
            except Exception as e:
                print(f"Error registering agent {agent_id} in runtime table: {e}")

        try:
            # while working:
            pass
        finally:
            # Deregister or update status in runtime table upon completion
            with SessionLocal() as db:
                try:
                    model.stop_runtime_instance(db=db, agent_id=agent_id)
                except Exception as e:
                    print(f"Error clearing runtime record for agent {agent_id}: {e}")

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