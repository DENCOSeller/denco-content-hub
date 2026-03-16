from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class CompanyUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)


class CompanyResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_default: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CompanyDetailResponse(CompanyResponse):
    workspaces_count: int
    members_count: int
    content_count: int
