from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(tags=["Integrations"])


class IntegrationStatusItem(BaseModel):
    configured: bool


class IntegrationsStatusResponse(BaseModel):
    youtube: IntegrationStatusItem
    instagram: IntegrationStatusItem


@router.get(
    "/integrations/status",
    response_model=IntegrationsStatusResponse,
    summary="Get integrations configuration status",
    responses={
        401: {"description": "Not authenticated"},
    },
)
async def integrations_status(
    _current_user: User = Depends(get_current_user),
) -> IntegrationsStatusResponse:
    return IntegrationsStatusResponse(
        youtube=IntegrationStatusItem(configured=bool(settings.youtube_api_key)),
        instagram=IntegrationStatusItem(configured=bool(settings.apify_api_key)),
    )
