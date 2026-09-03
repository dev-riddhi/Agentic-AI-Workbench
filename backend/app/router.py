from fastapi.routing import APIRouter

from app.features.agents.routes import router as agent_router
from app.features.ai_model.routes import router as ai_model_router
from app.features.documents.routes import router as document_router
from app.features.user.routes import router as user_router

router = APIRouter(prefix="/api/v1")

router.include_router(user_router,tags=["user"])
router.include_router(agent_router,tags=["agent"])
router.include_router(document_router,tags=["document"])
router.include_router(ai_model_router,tags=["ai_model"])
