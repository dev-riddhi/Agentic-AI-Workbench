import asyncio
from contextlib import asynccontextmanager
import logging
from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI

from app.features.agents.model import get_running_agents
from app.router import router
from database.database import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Test": "Success"}


app.include_router(router)