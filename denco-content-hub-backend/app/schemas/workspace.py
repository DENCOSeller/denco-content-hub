from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.workspace import WorkspaceRole


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    company_id: int | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_personal: bool
    role: WorkspaceRole
    company_id: int
    company_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceMemberResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    role: WorkspaceRole
    created_at: datetime

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    email: EmailStr
    role: WorkspaceRole

    @field_validator("role")
    @classmethod
    def role_not_owner(cls, v: WorkspaceRole) -> WorkspaceRole:
        if v == WorkspaceRole.OWNER:
            msg = "Cannot assign owner role"
            raise ValueError(msg)
        return v


class UpdateMemberRoleRequest(BaseModel):
    role: WorkspaceRole

    @field_validator("role")
    @classmethod
    def role_not_owner(cls, v: WorkspaceRole) -> WorkspaceRole:
        if v == WorkspaceRole.OWNER:
            msg = "Cannot assign owner role"
            raise ValueError(msg)
        return v


class TransferOwnershipRequest(BaseModel):
    target_member_id: int = Field(gt=0)
