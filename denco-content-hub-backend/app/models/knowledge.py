from __future__ import annotations

import enum
from datetime import datetime  # noqa: TC003
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

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

    # --- Provenance fields (Phase 2) ---
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")
    owner_role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True, server_default="medium")
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    superseded_by_node_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- Type definition reference (Phase 2) ---
    node_type_def_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("kg_node_type_defs.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- Relationships ---
    node_type_def: Mapped[KgNodeTypeDef | None] = relationship("KgNodeTypeDef", lazy="selectin")
    superseded_by: Mapped[KnowledgeNode | None] = relationship(
        "KnowledgeNode", remote_side="KnowledgeNode.id", lazy="selectin"
    )

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

    # --- Type definition reference (Phase 2) ---
    edge_type_def_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("kg_edge_type_defs.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- Relationships ---
    edge_type_def: Mapped[KgEdgeTypeDef | None] = relationship("KgEdgeTypeDef", lazy="selectin")

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


class KgNodeTypeDef(Base, TimestampMixin):
    __tablename__ = "kg_node_type_defs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    label_en: Mapped[str | None] = mapped_column(String(100), nullable=True)
    icon: Mapped[str] = mapped_column(String(50), nullable=False, server_default="IconNote")
    color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#8E8E93")
    gradient: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default="0")
    is_system: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=True,
    )

    __table_args__ = (
        Index(
            "uq_kntd_slug_company",
            "slug",
            text("COALESCE(company_id, 0)"),
            unique=True,
        ),
    )


class KgEdgeTypeDef(Base, TimestampMixin):
    __tablename__ = "kg_edge_type_defs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    label_en: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_directed: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    is_system: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=True,
    )

    __table_args__ = (
        Index(
            "uq_ketd_slug_company",
            "slug",
            text("COALESCE(company_id, 0)"),
            unique=True,
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

    # --- Provenance fields (Phase 2) ---
    status: Mapped[str | None] = mapped_column(String(20), nullable=True, server_default="active")
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)

    __table_args__ = (Index("ix_knv_node_version", "node_id", text("version_number DESC")),)


class KgConflict(Base, TimestampMixin):
    __tablename__ = "kg_conflicts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    workspace_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    conflict_type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="open")
    resolved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Relationships ---
    company_node: Mapped[KnowledgeNode] = relationship("KnowledgeNode", foreign_keys=[company_node_id], lazy="selectin")
    workspace_node: Mapped[KnowledgeNode] = relationship(
        "KnowledgeNode", foreign_keys=[workspace_node_id], lazy="selectin"
    )
    resolved_by: Mapped[User | None] = relationship("User", lazy="selectin")

    __table_args__ = (
        Index("ix_kgc_company_node", "company_node_id"),
        Index("ix_kgc_workspace_node", "workspace_node_id"),
        Index("ix_kgc_status", "status", postgresql_where=text("status = 'open'")),
        Index(
            "uq_kgc_pair_type_open",
            "company_node_id",
            "workspace_node_id",
            "conflict_type",
            unique=True,
            postgresql_where=text("status = 'open'"),
        ),
    )
