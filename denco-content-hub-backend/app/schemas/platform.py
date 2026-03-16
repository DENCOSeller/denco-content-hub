from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.models.workspace import WorkspaceRole


class PlatformWorkspaceResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_personal: bool
    company_id: int
    company_name: str
    members_count: int
    content_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformUserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    is_active: bool
    is_platform_owner: bool
    workspaces_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformJoinRequest(BaseModel):
    role: WorkspaceRole

    @field_validator("role")
    @classmethod
    def role_not_owner(cls, v: WorkspaceRole) -> WorkspaceRole:
        if v == WorkspaceRole.OWNER:
            msg = "Cannot assign owner role"
            raise ValueError(msg)
        return v
