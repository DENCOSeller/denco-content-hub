from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.models.invitation import InvitationStatus
from app.models.workspace import WorkspaceRole


class CreateInvitationRequest(BaseModel):
    email: EmailStr
    role: WorkspaceRole

    @field_validator("role")
    @classmethod
    def role_not_owner(cls, v: WorkspaceRole) -> WorkspaceRole:
        if v == WorkspaceRole.OWNER:
            msg = "Cannot invite as owner"
            raise ValueError(msg)
        return v


class InvitationResponse(BaseModel):
    id: int
    workspace_id: int
    email: str
    role: WorkspaceRole
    status: InvitationStatus
    invite_link: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class InvitationPublicResponse(BaseModel):
    workspace_name: str
    role: WorkspaceRole
    email: str  # masked: j***@example.com
    expires_at: datetime
