from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ErrorResponse, PaginatedResponse, PaginationParams
from app.schemas.invitation import (
    CreateInvitationRequest,
    InvitationPublicResponse,
    InvitationResponse,
)
from app.services.invitation_service import InvitationService

# Workspace-scoped invitations
ws_router = APIRouter(prefix="/workspaces/{workspace_id}/invitations", tags=["Invitations"])

# Public / auth invitation endpoints
public_router = APIRouter(prefix="/invitations", tags=["Invitations"])


@ws_router.post(
    "",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create workspace invitation (owner/admin)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
        409: {"model": ErrorResponse, "description": "User already a member or pending invite exists"},
    },
)
async def create_invitation(
    workspace_id: int,
    data: CreateInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InvitationResponse:
    service = InvitationService(db)
    return await service.create_invitation(current_user, workspace_id, data)


@ws_router.get(
    "",
    response_model=PaginatedResponse[InvitationResponse],
    summary="List workspace invitations (owner/admin)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_invitations(
    workspace_id: int,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[InvitationResponse]:
    service = InvitationService(db)
    params = PaginationParams(page=page, size=size)
    return await service.list_invitations(current_user, workspace_id, params)


@ws_router.delete(
    "/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel workspace invitation (owner/admin)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Invitation not found"},
        409: {"model": ErrorResponse, "description": "Invitation is not pending"},
    },
)
async def cancel_invitation(
    workspace_id: int,
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = InvitationService(db)
    await service.cancel_invitation(current_user, workspace_id, invitation_id)


@public_router.get(
    "/{token}",
    response_model=InvitationPublicResponse,
    summary="Get invitation info by token (public)",
    responses={
        404: {"model": ErrorResponse, "description": "Invitation not found or expired"},
        409: {"model": ErrorResponse, "description": "Invitation has expired"},
    },
)
async def get_invitation_info(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> InvitationPublicResponse:
    service = InvitationService(db)
    return await service.get_invitation_info(token)


@public_router.post(
    "/{token}/accept",
    response_model=None,
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Accept invitation (authenticated user)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Invitation email does not match your account"},
        404: {"model": ErrorResponse, "description": "Invitation not found"},
        409: {"model": ErrorResponse, "description": "Invitation expired, cancelled, or already a member"},
    },
)
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = InvitationService(db)
    await service.accept_invitation(token, current_user)
