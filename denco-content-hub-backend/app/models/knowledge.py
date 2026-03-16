from __future__ import annotations

import enum

from sqlalchemy import (
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class NodeType(enum.StrEnum):
    TARGET_AUDIENCE = "target_audience"
    MEANING = "meaning"
    CHANNEL = "channel"
    FUNNEL = "funnel"
    COMPETITOR = "competitor"
    SEO = "seo"
    BRAND = "brand"
    NOTE = "note"
    PLATFORM = "platform"
    CONTENT_FORMAT = "content_format"
    HUNT_LEVEL = "hunt_level"
    AUDIENCE_SEGMENT = "audience_segment"
    SPEAKER = "speaker"
    CONTENT_GOAL = "content_goal"
    NARRATIVE_FORMAT = "narrative_format"
    HOOK_TYPE = "hook_type"
    PRODUCT_FOCUS = "product_focus"
    TONE_OF_VOICE = "tone_of_voice"


class ScopeType(enum.StrEnum):
    COMPANY = "company"
    WORKSPACE = "workspace"


class ChangeType(enum.StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    AI_CREATED = "ai_created"
    AI_UPDATED = "ai_updated"


class KnowledgeNode(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "knowledge_nodes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    node_type: Mapped[NodeType] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    scope_type: Mapped[ScopeType] = mapped_column(String(20), nullable=False)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True)
    workspace_id: Mapped[int | None] = mapped_column(ForeignKey("workspaces.id", ondelete="RESTRICT"), nullable=True)

    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    position_x: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    position_y: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_position_fixed: Mapped[bool] = mapped_column(default=False, nullable=False)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "(company_id IS NOT NULL AND workspace_id IS NULL) OR (company_id IS NULL AND workspace_id IS NOT NULL)",
            name="ck_knowledge_nodes_scope",
        ),
        Index(
            "ix_kn_company",
            "company_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_kn_workspace",
            "workspace_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_kn_type_company",
            "node_type",
            "company_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_kn_type_workspace",
            "node_type",
            "workspace_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class KnowledgeEdge(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "knowledge_edges"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="RESTRICT"), nullable=False)
    target_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="RESTRICT"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        Index(
            "uq_ke_pair_label",
            "source_node_id",
            "target_node_id",
            "label",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_ke_source",
            "source_node_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_ke_target",
            "target_node_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class KnowledgeNodeVersion(Base, TimestampMixin):
    __tablename__ = "knowledge_node_versions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    node_type: Mapped[NodeType] = mapped_column(String(30), nullable=False)
    changed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    change_type: Mapped[ChangeType] = mapped_column(String(20), nullable=False)
    change_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (Index("ix_knv_node_version", "node_id", text("version_number DESC")),)
