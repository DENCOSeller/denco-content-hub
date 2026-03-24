from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class OrganizationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)


class OrganizationResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_default: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class OrganizationDetailResponse(OrganizationResponse):
    workspaces_count: int
    members_count: int
    content_count: int
