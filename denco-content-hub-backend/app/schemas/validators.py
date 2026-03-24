"""Shared Pydantic validators / mixins."""

from __future__ import annotations

from pydantic import field_validator

from app.models.workspace import WorkspaceRole, is_valid_workspace_role


class WorkspaceRoleValidatorMixin:
    """Mixin that validates ``role`` field against WorkspaceRole.

    Rules:
    - Owner role cannot be assigned directly.
    - Role must be a valid WorkspaceRole value.
    """

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v == WorkspaceRole.OWNER:
            msg = "Cannot assign owner role"
            raise ValueError(msg)
        if not is_valid_workspace_role(v):
            msg = f"Invalid role: {v}"
            raise ValueError(msg)
        return v
