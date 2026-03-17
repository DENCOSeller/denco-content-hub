from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.models.workspace import WorkspaceRole
from app.schemas.knowledge import (
    BatchPositionUpdateRequest,
    KgConflictResolve,
    KgConflictResponse,
    KnowledgeEdgeCreate,
    KnowledgeEdgeResponse,
    KnowledgeGraphResponse,
    KnowledgeNodeCreate,
    KnowledgeNodeResponse,
    KnowledgeNodeUpdate,
    KnowledgeNodeVersionResponse,
)
from app.services.kg_conflict_service import KgConflictService
from app.services.knowledge_service import KnowledgeService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User
    from app.models.workspace import Workspace, WorkspaceMember

router = APIRouter(prefix="/workspaces/{workspace_id}/knowledge", tags=["knowledge"])

WRITE_ROLES = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]


# --- Nodes ---


@router.get(
    "/nodes",
    response_model=list[KnowledgeNodeResponse],
    summary="List workspace knowledge nodes",
    status_code=200,
    responses={404: {"description": "Workspace not found"}},
)
async def list_nodes(
    node_type_def_id: int | None = Query(default=None),
    search: str | None = Query(default=None, max_length=255),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> list[KnowledgeNodeResponse]:
    workspace, _member = workspace_ctx
    service = KnowledgeService(db)
    return await service.get_workspace_nodes(workspace.id, node_type_def_id, search)


@router.post(
    "/nodes",
    response_model=KnowledgeNodeResponse,
    summary="Create workspace knowledge node",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Workspace not found"},
    },
)
async def create_node(
    data: KnowledgeNodeCreate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeNodeResponse:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    service = KnowledgeService(db)
    return await service.create_node(data, current_user.id, workspace_id=workspace.id)


# --- Positions (must be before /nodes/{node_id} to avoid route conflict) ---


@router.patch(
    "/nodes/positions",
    summary="Batch update node positions",
    status_code=200,
    responses={404: {"description": "Workspace not found"}},
)
async def batch_update_positions(
    data: BatchPositionUpdateRequest,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    workspace, _member = workspace_ctx
    service = KnowledgeService(db)
    positions = [p.model_dump() for p in data.positions]
    updated = await service.batch_update_positions(workspace.id, positions)
    return {"updated": updated}


@router.get(
    "/nodes/{node_id}",
    response_model=KnowledgeNodeResponse,
    summary="Get knowledge node",
    status_code=200,
    responses={404: {"description": "Node not found"}},
)
async def get_node(
    node_id: int,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeNodeResponse:
    _workspace, _member = workspace_ctx
    service = KnowledgeService(db)
    return await service.get_node(node_id)


@router.patch(
    "/nodes/{node_id}",
    response_model=KnowledgeNodeResponse,
    summary="Update knowledge node",
    status_code=200,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Node not found"},
    },
)
async def update_node(
    node_id: int,
    data: KnowledgeNodeUpdate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeNodeResponse:
    _workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    service = KnowledgeService(db)
    return await service.update_node(node_id, data, current_user.id)


@router.delete(
    "/nodes/{node_id}",
    summary="Delete knowledge node",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Node not found"},
    },
)
async def delete_node(
    node_id: int,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    service = KnowledgeService(db)
    await service.delete_node(node_id)
    return Response(status_code=204)


@router.get(
    "/nodes/{node_id}/versions",
    response_model=list[KnowledgeNodeVersionResponse],
    summary="Get node version history",
    status_code=200,
    responses={404: {"description": "Node not found"}},
)
async def get_node_versions(
    node_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> list[KnowledgeNodeVersionResponse]:
    _workspace, _member = workspace_ctx
    service = KnowledgeService(db)
    return await service.get_node_versions(node_id, limit)


# --- Edges ---


@router.post(
    "/edges",
    response_model=KnowledgeEdgeResponse,
    summary="Create knowledge edge",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Node not found"},
        409: {"description": "Edge already exists"},
    },
)
async def create_edge(
    data: KnowledgeEdgeCreate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeEdgeResponse:
    _workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    service = KnowledgeService(db)
    return await service.create_edge(data, current_user.id)


@router.delete(
    "/edges/{edge_id}",
    summary="Delete knowledge edge",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Edge not found"},
    },
)
async def delete_edge(
    edge_id: int,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    service = KnowledgeService(db)
    await service.delete_edge(edge_id)
    return Response(status_code=204)


# --- Graph ---


# --- Conflicts ---


@router.get(
    "/conflicts",
    response_model=list[KgConflictResponse],
    summary="List open knowledge graph conflicts",
    status_code=200,
    responses={404: {"description": "Workspace not found"}},
)
async def list_conflicts(
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> list[KgConflictResponse]:
    workspace, _member = workspace_ctx
    service = KgConflictService(db)
    return await service.get_open_conflicts(workspace.id)


@router.patch(
    "/conflicts/{conflict_id}",
    summary="Resolve or dismiss a knowledge graph conflict",
    status_code=200,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Conflict not found"},
    },
)
async def resolve_conflict(
    conflict_id: int,
    data: KgConflictResolve,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    service = KgConflictService(db)
    await service.resolve_conflict(conflict_id, current_user.id, data, workspace.id)
    return {"detail": "ok"}


@router.get(
    "/graph",
    response_model=KnowledgeGraphResponse,
    summary="Get workspace knowledge graph",
    status_code=200,
    responses={404: {"description": "Workspace not found"}},
)
async def get_graph(
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeGraphResponse:
    workspace, _member = workspace_ctx
    service = KnowledgeService(db)
    return await service.get_workspace_graph(workspace.id)
