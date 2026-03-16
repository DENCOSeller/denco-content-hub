from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends

from app.database import get_db
from app.dependencies import get_company_member, require_company_admin
from app.schemas.knowledge import (
    KgEdgeTypeDefCreate,
    KgEdgeTypeDefResponse,
    KgNodeTypeDefCreate,
    KgNodeTypeDefResponse,
)
from app.services.kg_type_service import KgTypeService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.company_member import CompanyMember

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
    db: AsyncSession = Depends(get_db),
) -> list[KgNodeTypeDefResponse]:
    service = KgTypeService(db)
    return await service.get_node_types(company_id)


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
    db: AsyncSession = Depends(get_db),
) -> KgNodeTypeDefResponse:
    service = KgTypeService(db)
    return await service.create_node_type(company_id, data)


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
    company_id: int,
    type_id: int,
    _admin: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = KgTypeService(db)
    await service.deactivate_node_type(type_id, company_id)


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
    db: AsyncSession = Depends(get_db),
) -> list[KgEdgeTypeDefResponse]:
    service = KgTypeService(db)
    return await service.get_edge_types(company_id)


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
    db: AsyncSession = Depends(get_db),
) -> KgEdgeTypeDefResponse:
    service = KgTypeService(db)
    return await service.create_edge_type(company_id, data)


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
    company_id: int,
    type_id: int,
    _admin: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = KgTypeService(db)
    await service.deactivate_edge_type(type_id, company_id)
