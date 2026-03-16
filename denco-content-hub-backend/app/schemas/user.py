from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    is_active: bool
    is_platform_owner: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
