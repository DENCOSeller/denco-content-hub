from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends

from app.dependencies import get_company_member, get_current_user, require_company_admin
from app.integrations import kg_client
from app.schemas.knowledge import (
    KgEdgeTypeDefCreate,
    KgEdgeTypeDefResponse,
    KgNodeTypeDefCreate,
    KgNodeTypeDefResponse,
)

if TYPE_CHECKING:
    from app.models.company_member import CompanyMember
    from app.models.user import User

router = APIRouter(prefix="/companies/{company_id}/knowledge/types", tags=["kg-types"])


# --- Node types ---


@router.get(
    "/nodes",
    response_model=list[KgNodeTypeDefResponse],
    summary="List KG node type definitions",
    status_code=200,
    responses={403: {"description": "Not a company member"}},
)
async def list_node_types(
    company_id: int,
    _member: CompanyMember = Depends(get_company_member),
    current_user: User = Depends(get_current_user),
) -> list[KgNodeTypeDefResponse]:
    return await kg_client.list_node_types(company_id, current_user.id)


@router.post(
    "/nodes",
    response_model=KgNodeTypeDefResponse,
    summary="Create custom KG node type",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
        409: {"description": "Slug already exists"},
    },
)
async def create_node_type(
    company_id: int,
    data: KgNodeTypeDefCreate,
    _admin: CompanyMember = Depends(require_company_admin),
    current_user: User = Depends(get_current_user),
) -> KgNodeTypeDefResponse:
    return await kg_client.create_node_type(
        company_id, current_user.id, data.model_dump(),
    )


@router.patch(
    "/nodes/{type_id}/deactivate",
    summary="Deactivate KG node type",
    status_code=204,
    responses={
        400: {"description": "Cannot deactivate system type"},
        403: {"description": "Insufficient permissions"},
        404: {"description": "Type not found"},
    },
)
async def deactivate_node_type(
    type_id: int,
    _admin: CompanyMember = Depends(require_company_admin),
    current_user: User = Depends(get_current_user),
) -> None:
    await kg_client.deactivate_node_type(type_id, current_user.id)


# --- Edge types ---


@router.get(
    "/edges",
    response_model=list[KgEdgeTypeDefResponse],
    summary="List KG edge type definitions",
    status_code=200,
    responses={403: {"description": "Not a company member"}},
)
async def list_edge_types(
    company_id: int,
    _member: CompanyMember = Depends(get_company_member),
    current_user: User = Depends(get_current_user),
) -> list[KgEdgeTypeDefResponse]:
    return await kg_client.list_edge_types(company_id, current_user.id)


@router.post(
    "/edges",
    response_model=KgEdgeTypeDefResponse,
    summary="Create custom KG edge type",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
        409: {"description": "Slug already exists"},
    },
)
async def create_edge_type(
    company_id: int,
    data: KgEdgeTypeDefCreate,
    _admin: CompanyMember = Depends(require_company_admin),
    current_user: User = Depends(get_current_user),
) -> KgEdgeTypeDefResponse:
    return await kg_client.create_edge_type(
        company_id, current_user.id, data.model_dump(),
    )


@router.patch(
    "/edges/{type_id}/deactivate",
    summary="Deactivate KG edge type",
    status_code=204,
    responses={
        400: {"description": "Cannot deactivate system type"},
        403: {"description": "Insufficient permissions"},
        404: {"description": "Type not found"},
    },
)
async def deactivate_edge_type(
    type_id: int,
    _admin: CompanyMember = Depends(require_company_admin),
    current_user: User = Depends(get_current_user),
) -> None:
    await kg_client.deactivate_edge_type(type_id, current_user.id)
