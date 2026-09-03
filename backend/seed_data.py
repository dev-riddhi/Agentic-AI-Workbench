from datetime import datetime, timezone
from uuid import uuid4
from database.database import SessionLocal
from database.models.user import User
from database.models.ai_model import AIModel
from database.models.agent import Agent
from database.models.document import Document
from database.models.tool import Tool

def seed_workbench():
    with SessionLocal() as db:
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        if not admin:
            print("Admin user not found. Run seed.py first.")
            return

        # 1. Seed or get AI Model
        model = db.query(AIModel).filter(AIModel.filename == "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf").first()
        if not model:
            model = AIModel(
                id=uuid4(),
                name="TinyLlama 1.1B Chat (Q4_K_M)",
                repo_id="TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
                filename="tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
                file_path="models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
                format="gguf",
                size_bytes=669229056,
                quantization="Q4_K_M",
                status="ready",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(model)
            db.commit()
            db.refresh(model)
            print(f"Seeded Model: {model.name} ({model.id})")

        # 2. Seed Document
        doc = db.query(Document).filter(Document.name == "hydraulic_pump_manual.pdf").first()
        if not doc:
            doc = Document(
                id=uuid4(),
                name="hydraulic_pump_manual.pdf",
                file_path="uploads/hydraulic_pump_manual.pdf",
                mime_type="application/pdf",
                created_at=datetime.now(timezone.utc),
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)
            print(f"Seeded Document: {doc.name} ({doc.id})")

        # 3. Get Tools
        tools = db.query(Tool).all()

        # 4. Seed Agent
        agent = db.query(Agent).filter(Agent.name == "Industrial Diagnostic Agent").first()
        if not agent:
            agent = Agent(
                id=uuid4(),
                owner_id=admin.id,
                name="Industrial Diagnostic Agent",
                description="Analyzes machine sensor telemetry and cross-references mechanical engineering documentation.",
                instructions="You are an on-premise industrial diagnostic assistant. Analyze machine status logs and check manuals for cavitation, pressure, and thermal anomalies.",
                model_id=model.id,
                model=model.name,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            agent.tools = tools
            agent.documents = [doc]
            db.add(agent)
            db.commit()
            db.refresh(agent)
            print(f"Seeded Agent: {agent.name} ({agent.id})")
        else:
            print(f"Agent already exists: {agent.name} ({agent.id})")

if __name__ == "__main__":
    seed_workbench()
