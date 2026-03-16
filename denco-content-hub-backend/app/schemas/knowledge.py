from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.company_member import CompanyRole
from app.models.knowledge import ChangeType, NodeType, ScopeType
from app.utils.tiptap import validate_tiptap

# --- CompanyMember ---


class CompanyMemberCreate(BaseModel):
    user_id: int = Field(gt=0)
    role: CompanyRole

    @field_validator("role")
    @classmethod
    def role_not_owner(cls, v: CompanyRole) -> CompanyRole:
        if v == CompanyRole.OWNER:
            msg = "Cannot assign owner role directly"
            raise ValueError(msg)
        return v


class CompanyMemberUpdate(BaseModel):
    role: CompanyRole

    @field_validator("role")
    @classmethod
    def role_not_owner(cls, v: CompanyRole) -> CompanyRole:
        if v == CompanyRole.OWNER:
            msg = "Cannot assign owner role directly"
            raise ValueError(msg)
        return v


class CompanyMemberResponse(BaseModel):
    id: int
    company_id: int
    user_id: int
    user_name: str
    user_email: str
    role: CompanyRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- KnowledgeNode ---


class KnowledgeNodeCreate(BaseModel):
    node_type: NodeType
    title: str = Field(min_length=1, max_length=500)
    content: dict | None = None
    color: str | None = Field(default=None, max_length=7)
    position_x: float = 0.0
    position_y: float = 0.0

    @model_validator(mode="after")
    def validate_content(self) -> Self:
        if self.content is not None and self.node_type != NodeType.SPEAKER and not validate_tiptap(self.content):
            msg = "Invalid TipTap document structure"
            raise ValueError(msg)
        return self


class KnowledgeNodeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    content: dict | None = None
    color: str | None = Field(default=None, max_length=7)
    position_x: float | None = None
    position_y: float | None = None
    is_position_fixed: bool | None = None

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: dict | None) -> dict | None:
        if v is not None and v.get("type") == "doc" and not validate_tiptap(v):
            msg = "Invalid TipTap document structure"
            raise ValueError(msg)
        return v


class KnowledgeNodeResponse(BaseModel):
    id: int
    node_type: NodeType
    title: str
    content: dict | None = None
    content_text: str | None = None
    scope_type: ScopeType
    company_id: int | None = None
    workspace_id: int | None = None
    created_by_user_id: int
    updated_by_user_id: int
    position_x: float
    position_y: float
    is_position_fixed: bool
    color: str | None = None
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- KnowledgeEdge ---


class KnowledgeEdgeCreate(BaseModel):
    source_node_id: int = Field(gt=0)
    target_node_id: int = Field(gt=0)
    label: str = Field(min_length=1, max_length=255)
    description: str | None = None
    weight: float = 1.0

    @model_validator(mode="after")
    def source_not_target(self) -> Self:
        if self.source_node_id == self.target_node_id:
            msg = "Source and target nodes must be different"
            raise ValueError(msg)
        return self


class KnowledgeEdgeResponse(BaseModel):
    id: int
    source_node_id: int
    target_node_id: int
    label: str
    description: str | None = None
    weight: float
    created_by_user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Graph ---


class KnowledgeGraphResponse(BaseModel):
    nodes: list[KnowledgeNodeResponse]
    edges: list[KnowledgeEdgeResponse]


# --- Version ---


class KnowledgeNodeVersionResponse(BaseModel):
    id: int
    node_id: int
    version_number: int
    title: str
    content: dict | None = None
    content_text: str | None = None
    node_type: NodeType
    change_type: ChangeType
    change_summary: str | None = None
    changed_by_user_id: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Batch positions ---


class NodePositionUpdate(BaseModel):
    node_id: int = Field(gt=0)
    position_x: float
    position_y: float


class BatchPositionUpdateRequest(BaseModel):
    positions: list[NodePositionUpdate] = Field(max_length=500)
