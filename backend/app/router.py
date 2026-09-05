from fastapi.routing import APIRouter

from app.features.agents.routes import router as agent_router
from app.features.ai_model.routes import router as ai_model_router
from app.features.chat.routes import router as chat_router
from app.features.documents.routes import router as document_router
from app.features.runtime.routes import router as runtime_router
from app.features.settings.routes import router as settings_router
from app.features.user.routes import router as user_router

router = APIRouter(prefix="/api/v1")

router.include_router(user_router, tags=["user"])
router.include_router(agent_router, tags=["agent"])
router.include_router(chat_router, tags=["chat"])
router.include_router(document_router, tags=["document"])
router.include_router(ai_model_router, tags=["ai_model"])
router.include_router(runtime_router, tags=["runtime"])
router.include_router(settings_router, tags=["settings"])

