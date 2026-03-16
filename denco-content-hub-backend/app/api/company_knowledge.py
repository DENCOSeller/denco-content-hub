from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.dependencies import get_company_member, get_current_user, require_company_admin
from app.models.knowledge import NodeType  # noqa: TC001 — runtime for FastAPI query param
from app.schemas.knowledge import (
    BatchPositionUpdateRequest,
    KnowledgeEdgeCreate,
    KnowledgeEdgeResponse,
    KnowledgeGraphResponse,
    KnowledgeNodeCreate,
    KnowledgeNodeResponse,
    KnowledgeNodeUpdate,
    KnowledgeNodeVersionResponse,
)
from app.services.knowledge_service import KnowledgeService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.company_member import CompanyMember
    from app.models.user import User

router = APIRouter(prefix="/companies/{company_id}/knowledge", tags=["company-knowledge"])


# --- Nodes ---


@router.get(
    "/nodes",
    response_model=list[KnowledgeNodeResponse],
    summary="List company knowledge nodes",
    status_code=200,
    responses={403: {"description": "Not a company member"}},
)
async def list_nodes(
    company_id: int,
    node_type: NodeType | None = Query(default=None),
    search: str | None = Query(default=None, max_length=255),
    _member: CompanyMember = Depends(get_company_member),
    db: AsyncSession = Depends(get_db),
) -> list[KnowledgeNodeResponse]:
    service = KnowledgeService(db)
    return await service.get_company_nodes(company_id, node_type, search)


@router.post(
    "/nodes",
    response_model=KnowledgeNodeResponse,
    summary="Create company knowledge node",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
    },
)
async def create_node(
    company_id: int,
    data: KnowledgeNodeCreate,
    current_user: User = Depends(get_current_user),
    _admin: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeNodeResponse:
    service = KnowledgeService(db)
    return await service.create_node(data, current_user.id, company_id=company_id)


# --- Positions (must be before /nodes/{node_id} to avoid route conflict) ---


@router.patch(
    "/nodes/positions",
    summary="Batch update company node positions",
    status_code=200,
    responses={403: {"description": "Not a company member"}},
)
async def batch_update_positions(
    company_id: int,
    data: BatchPositionUpdateRequest,
    _member: CompanyMember = Depends(get_company_member),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    service = KnowledgeService(db)
    positions = [p.model_dump() for p in data.positions]
    updated = await service.batch_update_company_positions(company_id, positions)
    return {"updated": updated}


@router.get(
    "/nodes/{node_id}",
    response_model=KnowledgeNodeResponse,
    summary="Get company knowledge node",
    status_code=200,
    responses={
        403: {"description": "Not a company member"},
        404: {"description": "Node not found"},
    },
)
async def get_node(
    node_id: int,
    _member: CompanyMember = Depends(get_company_member),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeNodeResponse:
    service = KnowledgeService(db)
    return await service.get_node(node_id)


@router.patch(
    "/nodes/{node_id}",
    response_model=KnowledgeNodeResponse,
    summary="Update company knowledge node",
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
    _admin: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeNodeResponse:
    service = KnowledgeService(db)
    return await service.update_node(node_id, data, current_user.id)


@router.delete(
    "/nodes/{node_id}",
    summary="Delete company knowledge node",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Node not found"},
    },
)
async def delete_node(
    node_id: int,
    _admin: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = KnowledgeService(db)
    await service.delete_node(node_id)
    return Response(status_code=204)


@router.get(
    "/nodes/{node_id}/versions",
    response_model=list[KnowledgeNodeVersionResponse],
    summary="Get company node version history",
    status_code=200,
    responses={
        403: {"description": "Not a company member"},
        404: {"description": "Node not found"},
    },
)
async def get_node_versions(
    node_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    _member: CompanyMember = Depends(get_company_member),
    db: AsyncSession = Depends(get_db),
) -> list[KnowledgeNodeVersionResponse]:
    service = KnowledgeService(db)
    return await service.get_node_versions(node_id, limit)


# --- Edges ---


@router.post(
    "/edges",
    response_model=KnowledgeEdgeResponse,
    summary="Create company knowledge edge",
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
    _admin: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeEdgeResponse:
    service = KnowledgeService(db)
    return await service.create_edge(data, current_user.id)


@router.delete(
    "/edges/{edge_id}",
    summary="Delete company knowledge edge",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Edge not found"},
    },
)
async def delete_edge(
    edge_id: int,
    _admin: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = KnowledgeService(db)
    await service.delete_edge(edge_id)
    return Response(status_code=204)


# --- Graph ---


@router.get(
    "/graph",
    response_model=KnowledgeGraphResponse,
    summary="Get company knowledge graph",
    status_code=200,
    responses={403: {"description": "Not a company member"}},
)
async def get_graph(
    company_id: int,
    _member: CompanyMember = Depends(get_company_member),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeGraphResponse:
    service = KnowledgeService(db)
    return await service.get_company_graph(company_id)
