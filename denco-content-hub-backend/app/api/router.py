from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.ai_proxy import router as ai_proxy_router
from app.api.analysis import router as analysis_router
from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.company_knowledge import router as company_knowledge_router
from app.api.company_members import router as company_members_router
from app.api.competitors import notifications_router as competitor_notifications_router
from app.api.competitors import router as competitors_router
from app.api.content import router as content_router
from app.api.content_chat import router as content_chat_router
from app.api.content_plan import router as content_plan_router
from app.api.health import router as health_router
from app.api.intelligence import comp_router as intelligence_comp_router
from app.api.intelligence import ref_router as intelligence_ref_router
from app.api.invitations import public_router as invitations_public_router
from app.api.invitations import ws_router as invitations_ws_router
from app.api.kg_types import router as kg_types_router
from app.api.knowledge import router as knowledge_router
from app.api.library import router as library_router
from app.api.platform import router as platform_router
from app.api.public_knowledge import router as public_knowledge_router
from app.api.transcription import router as transcription_router
from app.api.users import router as users_router
from app.api.workspaces import router as workspaces_router
from app.config import settings

api_router = APIRouter(prefix=settings.api_v1_prefix)
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(workspaces_router)
api_router.include_router(invitations_ws_router)
api_router.include_router(invitations_public_router)
api_router.include_router(content_router)
api_router.include_router(transcription_router)
api_router.include_router(platform_router)
api_router.include_router(companies_router)
api_router.include_router(company_members_router)
api_router.include_router(knowledge_router)
api_router.include_router(company_knowledge_router)
api_router.include_router(kg_types_router)
api_router.include_router(ai_proxy_router)
api_router.include_router(analysis_router)
api_router.include_router(intelligence_ref_router)
api_router.include_router(intelligence_comp_router)
api_router.include_router(content_chat_router)
api_router.include_router(library_router)
api_router.include_router(content_plan_router)
api_router.include_router(competitors_router)
api_router.include_router(competitor_notifications_router)
api_router.include_router(admin_router)
api_router.include_router(public_knowledge_router)
