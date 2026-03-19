from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.integrations import kg_client
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
from app.schemas.public_knowledge import (
    KgPublicLinkCreateRequest,
    KgPublicLinkNodeAdd,
    KgPublicLinkResponse,
    KgPublicLinkUpdate,
)

if TYPE_CHECKING:
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
    current_user: User = Depends(get_current_user),
) -> list[KnowledgeNodeResponse]:
    workspace, _member = workspace_ctx
    return await kg_client.list_nodes(
        "workspace",
        workspace.id,
        current_user.id,
        node_type_def_id=node_type_def_id,
        search=search,
    )


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
) -> KnowledgeNodeResponse:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    return await kg_client.create_node(
        "workspace",
        workspace.id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


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
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    workspace, _member = workspace_ctx
    positions = [p.model_dump() for p in data.positions]
    result = await kg_client.batch_update_positions(
        "workspace",
        workspace.id,
        current_user.id,
        positions,
    )
    return result


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
    current_user: User = Depends(get_current_user),
) -> KnowledgeNodeResponse:
    _workspace, _member = workspace_ctx
    return await kg_client.get_node(node_id, current_user.id)


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
) -> KnowledgeNodeResponse:
    _workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    return await kg_client.update_node(
        node_id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


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
    current_user: User = Depends(get_current_user),
) -> Response:
    _workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    await kg_client.delete_node(node_id, current_user.id)
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
    current_user: User = Depends(get_current_user),
) -> list[KnowledgeNodeVersionResponse]:
    _workspace, _member = workspace_ctx
    return await kg_client.get_node_versions(node_id, current_user.id, limit=limit)


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
) -> KnowledgeEdgeResponse:
    _workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    return await kg_client.create_edge(
        "workspace",
        workspace_ctx[0].id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


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
    current_user: User = Depends(get_current_user),
) -> Response:
    _workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    await kg_client.delete_edge(edge_id, current_user.id)
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
    current_user: User = Depends(get_current_user),
) -> list[KgConflictResponse]:
    workspace, _member = workspace_ctx
    return await kg_client.list_conflicts("workspace", workspace.id, current_user.id)


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
) -> dict[str, str]:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    await kg_client.resolve_conflict(conflict_id, current_user.id, data.model_dump())
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
    current_user: User = Depends(get_current_user),
) -> KnowledgeGraphResponse:
    workspace, _member = workspace_ctx
    return await kg_client.get_graph(
        "workspace",
        workspace.id,
        current_user.id,
        include_company=True,
        company_id=workspace.company_id,
    )


# --- Public Links ---


@router.post(
    "/public-links",
    response_model=KgPublicLinkResponse,
    summary="Create workspace public link",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Workspace not found"},
    },
)
async def create_workspace_public_link(
    data: KgPublicLinkCreateRequest,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
) -> KgPublicLinkResponse:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    return await kg_client.create_public_link(
        "workspace",
        workspace.id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


@router.get(
    "/public-links",
    response_model=list[KgPublicLinkResponse],
    summary="List workspace public links",
    status_code=200,
    responses={404: {"description": "Workspace not found"}},
)
async def list_workspace_public_links(
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
) -> list[KgPublicLinkResponse]:
    workspace, _member = workspace_ctx
    return await kg_client.list_public_links("workspace", workspace.id, current_user.id)


@router.patch(
    "/public-links/{link_id}",
    response_model=KgPublicLinkResponse,
    summary="Update workspace public link",
    status_code=200,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Link not found"},
    },
)
async def update_workspace_public_link(
    link_id: int,
    data: KgPublicLinkUpdate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
) -> KgPublicLinkResponse:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    return await kg_client.update_public_link(
        link_id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


@router.delete(
    "/public-links/{link_id}",
    summary="Delete workspace public link",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Link not found"},
    },
)
async def delete_workspace_public_link(
    link_id: int,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
) -> Response:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    await kg_client.delete_public_link(link_id, current_user.id)
    return Response(status_code=204)


@router.post(
    "/public-links/{link_id}/nodes",
    summary="Add node to workspace public link (режим selected)",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Link not found"},
    },
)
async def add_node_to_workspace_public_link(
    link_id: int,
    data: KgPublicLinkNodeAdd,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
) -> Response:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    await kg_client.add_node_to_link(link_id, data.node_id, current_user.id)
    return Response(status_code=204)


@router.delete(
    "/public-links/{link_id}/nodes/{node_id}",
    summary="Remove node from workspace public link",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Link or node not found"},
    },
)
async def remove_node_from_workspace_public_link(
    link_id: int,
    node_id: int,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
) -> Response:
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)
    await kg_client.remove_node_from_link(link_id, node_id, current_user.id)
    return Response(status_code=204)
