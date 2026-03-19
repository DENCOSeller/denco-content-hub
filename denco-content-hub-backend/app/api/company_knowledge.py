from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.dependencies import get_company_member, get_current_user, require_company_admin
from app.integrations import kg_client
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
from app.schemas.public_knowledge import (
    KgPublicLinkCreateRequest,
    KgPublicLinkNodeAdd,
    KgPublicLinkResponse,
    KgPublicLinkUpdate,
)

if TYPE_CHECKING:
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
    node_type_def_id: int | None = Query(default=None),
    search: str | None = Query(default=None, max_length=255),
    _member: CompanyMember = Depends(get_company_member),
    current_user: User = Depends(get_current_user),
) -> list[KnowledgeNodeResponse]:
    return await kg_client.list_nodes(
        "company",
        company_id,
        current_user.id,
        node_type_def_id=node_type_def_id,
        search=search,
    )


@router.post(
    "/nodes",
    response_model=KnowledgeNodeResponse,
    summary="Create company knowledge node",
    status_code=201,
    responses={403: {"description": "Insufficient permissions"}},
)
async def create_node(
    company_id: int,
    data: KnowledgeNodeCreate,
    current_user: User = Depends(get_current_user),
    _admin: CompanyMember = Depends(require_company_admin),
) -> KnowledgeNodeResponse:
    return await kg_client.create_node(
        "company",
        company_id,
        current_user.id,
        data.model_dump(exclude_none=True),
        company_scope_id=company_id,
    )


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
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    positions = [p.model_dump() for p in data.positions]
    return await kg_client.batch_update_positions(
        "company",
        company_id,
        current_user.id,
        positions,
    )


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
    current_user: User = Depends(get_current_user),
) -> KnowledgeNodeResponse:
    return await kg_client.get_node(node_id, current_user.id)


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
) -> KnowledgeNodeResponse:
    return await kg_client.update_node(
        node_id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


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
    current_user: User = Depends(get_current_user),
) -> Response:
    await kg_client.delete_node(node_id, current_user.id)
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
    current_user: User = Depends(get_current_user),
) -> list[KnowledgeNodeVersionResponse]:
    return await kg_client.get_node_versions(node_id, current_user.id, limit=limit)


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
    company_id: int,
    data: KnowledgeEdgeCreate,
    current_user: User = Depends(get_current_user),
    _admin: CompanyMember = Depends(require_company_admin),
) -> KnowledgeEdgeResponse:
    return await kg_client.create_edge(
        "company",
        company_id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


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
    current_user: User = Depends(get_current_user),
) -> Response:
    await kg_client.delete_edge(edge_id, current_user.id)
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
    current_user: User = Depends(get_current_user),
) -> KnowledgeGraphResponse:
    return await kg_client.get_graph("company", company_id, current_user.id)


# --- Public Links ---


@router.post(
    "/public-links",
    response_model=KgPublicLinkResponse,
    summary="Create company public link",
    status_code=201,
    responses={403: {"description": "Insufficient permissions"}},
)
async def create_company_public_link(
    company_id: int,
    data: KgPublicLinkCreateRequest,
    current_user: User = Depends(get_current_user),
    _admin: CompanyMember = Depends(require_company_admin),
) -> KgPublicLinkResponse:
    return await kg_client.create_public_link(
        "company",
        company_id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


@router.get(
    "/public-links",
    response_model=list[KgPublicLinkResponse],
    summary="List company public links",
    status_code=200,
    responses={403: {"description": "Not a company member"}},
)
async def list_company_public_links(
    company_id: int,
    _member: CompanyMember = Depends(get_company_member),
    current_user: User = Depends(get_current_user),
) -> list[KgPublicLinkResponse]:
    return await kg_client.list_public_links("company", company_id, current_user.id)


@router.patch(
    "/public-links/{link_id}",
    response_model=KgPublicLinkResponse,
    summary="Update company public link",
    status_code=200,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Link not found"},
    },
)
async def update_company_public_link(
    link_id: int,
    data: KgPublicLinkUpdate,
    current_user: User = Depends(get_current_user),
    _admin: CompanyMember = Depends(require_company_admin),
) -> KgPublicLinkResponse:
    return await kg_client.update_public_link(
        link_id,
        current_user.id,
        data.model_dump(exclude_none=True),
    )


@router.delete(
    "/public-links/{link_id}",
    summary="Delete company public link",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Link not found"},
    },
)
async def delete_company_public_link(
    company_id: int,
    link_id: int,
    _admin: CompanyMember = Depends(require_company_admin),
    current_user: User = Depends(get_current_user),
) -> Response:
    await kg_client.delete_public_link(link_id, current_user.id)
    return Response(status_code=204)


@router.post(
    "/public-links/{link_id}/nodes",
    summary="Add node to company public link (режим selected)",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Link not found"},
    },
)
async def add_node_to_company_public_link(
    link_id: int,
    data: KgPublicLinkNodeAdd,
    _admin: CompanyMember = Depends(require_company_admin),
    current_user: User = Depends(get_current_user),
) -> Response:
    await kg_client.add_node_to_link(link_id, data.node_id, current_user.id)
    return Response(status_code=204)


@router.delete(
    "/public-links/{link_id}/nodes/{node_id}",
    summary="Remove node from company public link",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Link or node not found"},
    },
)
async def remove_node_from_company_public_link(
    link_id: int,
    node_id: int,
    _admin: CompanyMember = Depends(require_company_admin),
    current_user: User = Depends(get_current_user),
) -> Response:
    await kg_client.remove_node_from_link(link_id, node_id, current_user.id)
    return Response(status_code=204)
