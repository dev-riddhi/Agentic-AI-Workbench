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


@asynccontextmanager
async def lifespan(app: FastAPI):
    while(True):

        await asyncio.sleep(60)


app = FastAPI()

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