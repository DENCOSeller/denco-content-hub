from __future__ import annotations

from datetime import datetime  # noqa: TC003

from pydantic import BaseModel, ConfigDict, computed_field

from app.config import settings
from app.schemas.knowledge import KgNodeTypeDefResponse  # noqa: TC001


class KgPublicLinkCreate(BaseModel):
    scope_type: str
    scope_id: int
    visibility_mode: str = "active"
    title: str | None = None
    description: str | None = None
    expires_at: datetime | None = None


class KgPublicLinkUpdate(BaseModel):
    is_active: bool | None = None
    visibility_mode: str | None = None
    title: str | None = None
    description: str | None = None
    expires_at: datetime | None = None


class KgPublicLinkResponse(BaseModel):
    id: int
    token: str
    scope_type: str
    scope_id: int
    is_active: bool
    visibility_mode: str
    title: str | None = None
    description: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    created_by_user_id: int | None = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def public_url(self) -> str:
        return f"{settings.frontend_url}/public/graph/{self.token}"


class KgPublicLinkCreateRequest(BaseModel):
    """Тело запроса для создания ссылки — scope задаётся из path."""

    visibility_mode: str = "active"
    title: str | None = None
    description: str | None = None
    expires_at: datetime | None = None


class KgPublicLinkNodeAdd(BaseModel):
    node_id: int


class PublicKnowledgeNodeResponse(BaseModel):
    id: int
    title: str
    status: str
    position_x: float
    position_y: float
    color: str | None = None
    content: dict | None = None
    node_type_def: KgNodeTypeDefResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class PublicKnowledgeEdgeResponse(BaseModel):
    id: int
    source_node_id: int
    target_node_id: int
    label: str
    weight: float

    model_config = ConfigDict(from_attributes=True)


class PublicKnowledgeGraphResponse(BaseModel):
    nodes: list[PublicKnowledgeNodeResponse]
    edges: list[PublicKnowledgeEdgeResponse]
    title: str | None = None
    description: str | None = None
