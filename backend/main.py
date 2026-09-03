from contextlib import asynccontextmanager
import logging
from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI

from app.features.agents.model import get_running_agents
from app.router import router
from database.database import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # System startup: Recover agents marked as running with auto_restart enabled
    with SessionLocal() as db:
        try:
            active_agents = get_running_agents(db, auto_restart_only=True)
            if active_agents:
                logger.info(
                    f"[System Startup] Found {len(active_agents)} active agent(s) to automatically resume after restart."
                )
                for ra in active_agents:
                    logger.info(f"[Auto-Restart] Resuming agent: {ra.agent_id}")
            else:
                logger.info("[System Startup] No running agents to resume.")
        except Exception as exc:
            logger.warning(f"[System Startup] Could not load running agents: {exc}")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # List specific origins for production, e.g., ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Test": "Success"}


app.include_router(router)