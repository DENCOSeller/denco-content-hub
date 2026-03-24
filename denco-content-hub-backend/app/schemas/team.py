from datetime import datetime

from pydantic import BaseModel, Field


class TeamResponse(BaseModel):
    id: int
    staff_team_id: int
    organization_id: int
    name: str
    slug: str
    member_count: int
    synced_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamWorkspaceAccessResponse(BaseModel):
    id: int
    team_id: int
    workspace_id: int
    workspace_name: str
    workspace_slug: str
    default_role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamWorkspaceAccessCreate(BaseModel):
    workspace_id: int = Field(gt=0)
    default_role: str = Field(default="viewer", pattern="^(owner|admin|editor|viewer|contractor)$")
