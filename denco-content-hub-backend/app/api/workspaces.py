from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ErrorResponse, PaginatedResponse, PaginationParams
from app.schemas.workspace import (
    AddMemberRequest,
    TransferOwnershipRequest,
    UpdateMemberRoleRequest,
    WorkspaceCreate,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.services.workspace_member_service import WorkspaceMemberService
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


@router.get(
    "",
    response_model=list[WorkspaceResponse],
    summary="List current user's workspaces",
    responses={401: {"model": ErrorResponse, "description": "Not authenticated"}},
)
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WorkspaceResponse]:
    service = WorkspaceService(db)
    return await service.get_user_workspaces(current_user)


@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new workspace",
    responses={401: {"model": ErrorResponse, "description": "Not authenticated"}},
)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    service = WorkspaceService(db)
    return await service.create_workspace(current_user, data)


@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Get workspace details",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def get_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    service = WorkspaceService(db)
    return await service.get_workspace_detail(current_user, workspace_id)


@router.patch(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Update workspace (owner/admin)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def update_workspace(
    workspace_id: int,
    data: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    service = WorkspaceService(db)
    return await service.update_workspace(current_user, workspace_id, data)


@router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete workspace (owner only)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def delete_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = WorkspaceService(db)
    await service.delete_workspace(current_user, workspace_id)


@router.post(
    "/{workspace_id}/transfer-ownership",
    response_model=WorkspaceResponse,
    summary="Transfer workspace ownership to another member (owner only)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace or member not found"},
        409: {"model": ErrorResponse, "description": "Target is already the owner"},
    },
)
async def transfer_ownership(
    workspace_id: int,
    data: TransferOwnershipRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    service = WorkspaceService(db)
    return await service.transfer_ownership(current_user, workspace_id, data)


@router.get(
    "/{workspace_id}/members",
    response_model=PaginatedResponse[WorkspaceMemberResponse],
    summary="List workspace members (paginated)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_members(
    workspace_id: int,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[WorkspaceMemberResponse]:
    service = WorkspaceMemberService(db)
    params = PaginationParams(page=page, size=size)
    return await service.list_members(current_user, workspace_id, params)


@router.post(
    "/{workspace_id}/members",
    response_model=WorkspaceMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add member to workspace (owner/admin)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "User not found"},
        409: {"model": ErrorResponse, "description": "User is already a member"},
    },
)
async def add_member(
    workspace_id: int,
    data: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMemberResponse:
    service = WorkspaceMemberService(db)
    return await service.add_member(current_user, workspace_id, data)


@router.patch(
    "/{workspace_id}/members/{member_id}",
    response_model=WorkspaceMemberResponse,
    summary="Update member role (owner/admin)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Member not found"},
    },
)
async def update_member_role(
    workspace_id: int,
    member_id: int,
    data: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMemberResponse:
    service = WorkspaceMemberService(db)
    return await service.update_member_role(current_user, workspace_id, member_id, data)


@router.delete(
    "/{workspace_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove member from workspace (owner/admin)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Member not found"},
    },
)
async def remove_member(
    workspace_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = WorkspaceMemberService(db)
    await service.remove_member(current_user, workspace_id, member_id)


@router.post(
    "/{workspace_id}/members/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Leave workspace (cannot leave if owner)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Owner cannot leave"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def leave_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = WorkspaceMemberService(db)
    await service.leave_workspace(current_user, workspace_id)
