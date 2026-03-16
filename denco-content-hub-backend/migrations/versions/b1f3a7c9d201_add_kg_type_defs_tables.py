"""add kg_node_type_defs and kg_edge_type_defs tables

Revision ID: b1f3a7c9d201
Revises: a82ad052df80
Create Date: 2026-03-16 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1f3a7c9d201"
down_revision: str | None = "a82ad052df80"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- kg_node_type_defs ---
    kg_node_type_defs = op.create_table(
        "kg_node_type_defs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("label_en", sa.String(length=100), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=False, server_default="IconNote"),
        sa.Column("color", sa.String(length=7), nullable=False, server_default="#8E8E93"),
        sa.Column("gradient", sa.String(length=200), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
    )

    op.create_index(
        "uq_kntd_slug_company",
        "kg_node_type_defs",
        ["slug", sa.text("COALESCE(company_id, 0)")],
        unique=True,
    )

    # --- kg_edge_type_defs ---
    kg_edge_type_defs = op.create_table(
        "kg_edge_type_defs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("label_en", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_directed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
    )

    op.create_index(
        "uq_ketd_slug_company",
        "kg_edge_type_defs",
        ["slug", sa.text("COALESCE(company_id, 0)")],
        unique=True,
    )

    # --- Seed: 18 системных типов узлов ---
    op.bulk_insert(
        kg_node_type_defs,
        [
            {
                "slug": "target_audience",
                "label": "Целевая аудитория",
                "label_en": "Target Audience",
                "icon": "IconTarget",
                "color": "#0A84FF",
                "gradient": "linear-gradient(135deg, #0A84FF, #3B9EFF)",
                "sort_order": 0,
                "is_system": True,
            },
            {
                "slug": "meaning",
                "label": "Смысл",
                "label_en": "Meaning",
                "icon": "IconBulb",
                "color": "#FFD60A",
                "gradient": "linear-gradient(135deg, #FFD60A, #FFE44D)",
                "sort_order": 1,
                "is_system": True,
            },
            {
                "slug": "channel",
                "label": "Канал",
                "label_en": "Channel",
                "icon": "IconSpeakerphone",
                "color": "#30D158",
                "gradient": "linear-gradient(135deg, #30D158, #5CE07A)",
                "sort_order": 2,
                "is_system": True,
            },
            {
                "slug": "funnel",
                "label": "Воронка",
                "label_en": "Funnel",
                "icon": "IconArrowsSort",
                "color": "#BF5AF2",
                "gradient": "linear-gradient(135deg, #BF5AF2, #D084F5)",
                "sort_order": 3,
                "is_system": True,
            },
            {
                "slug": "competitor",
                "label": "Конкурент",
                "label_en": "Competitor",
                "icon": "IconUsers",
                "color": "#FF453A",
                "gradient": "linear-gradient(135deg, #FF453A, #FF6961)",
                "sort_order": 4,
                "is_system": True,
            },
            {
                "slug": "seo",
                "label": "SEO",
                "label_en": "SEO",
                "icon": "IconSearch",
                "color": "#FF9F0A",
                "gradient": "linear-gradient(135deg, #FF9F0A, #FFB84D)",
                "sort_order": 5,
                "is_system": True,
            },
            {
                "slug": "brand",
                "label": "Бренд",
                "label_en": "Brand",
                "icon": "IconBrandNotion",
                "color": "#32ADE6",
                "gradient": "linear-gradient(135deg, #32ADE6, #5CC2EE)",
                "sort_order": 6,
                "is_system": True,
            },
            {
                "slug": "note",
                "label": "Заметка",
                "label_en": "Note",
                "icon": "IconNote",
                "color": "#8E8E93",
                "gradient": "linear-gradient(135deg, #8E8E93, #AEAEB2)",
                "sort_order": 7,
                "is_system": True,
            },
            {
                "slug": "speaker",
                "label": "Спикер",
                "label_en": "Speaker",
                "icon": "IconMicrophone2",
                "color": "#5856D6",
                "gradient": "linear-gradient(135deg, #5856D6, #7A79E0)",
                "sort_order": 8,
                "is_system": True,
            },
            {
                "slug": "content_goal",
                "label": "Цель контента",
                "label_en": "Content Goal",
                "icon": "IconFocus2",
                "color": "#34C759",
                "gradient": "linear-gradient(135deg, #34C759, #5DD57A)",
                "sort_order": 9,
                "is_system": True,
            },
            {
                "slug": "narrative_format",
                "label": "Формат нарратива",
                "label_en": "Narrative Format",
                "icon": "IconMovie",
                "color": "#AF52DE",
                "gradient": "linear-gradient(135deg, #AF52DE, #C77CE6)",
                "sort_order": 10,
                "is_system": True,
            },
            {
                "slug": "hook_type",
                "label": "Тип хука",
                "label_en": "Hook Type",
                "icon": "IconFishHook",
                "color": "#FF2D55",
                "gradient": "linear-gradient(135deg, #FF2D55, #FF6482)",
                "sort_order": 11,
                "is_system": True,
            },
            {
                "slug": "product_focus",
                "label": "Фокус продукта",
                "label_en": "Product Focus",
                "icon": "IconBox",
                "color": "#00C7BE",
                "gradient": "linear-gradient(135deg, #00C7BE, #33D4CD)",
                "sort_order": 12,
                "is_system": True,
            },
            {
                "slug": "tone_of_voice",
                "label": "Тон голоса",
                "label_en": "Tone of Voice",
                "icon": "IconMoodSmile",
                "color": "#FF6B35",
                "gradient": "linear-gradient(135deg, #FF6B35, #FF8F64)",
                "sort_order": 13,
                "is_system": True,
            },
            {
                "slug": "platform",
                "label": "Платформа",
                "label_en": "Platform",
                "icon": "IconDeviceTv",
                "color": "#007AFF",
                "gradient": "linear-gradient(135deg, #007AFF, #4DA3FF)",
                "sort_order": 14,
                "is_system": True,
            },
            {
                "slug": "content_format",
                "label": "Формат контента",
                "label_en": "Content Format",
                "icon": "IconLayoutGrid",
                "color": "#FF9500",
                "gradient": "linear-gradient(135deg, #FF9500, #FFAD33)",
                "sort_order": 15,
                "is_system": True,
            },
            {
                "slug": "hunt_level",
                "label": "Уровень Ханта",
                "label_en": "Hunt Level",
                "icon": "IconStairs",
                "color": "#5856D6",
                "gradient": "linear-gradient(135deg, #5856D6, #7A78E0)",
                "sort_order": 16,
                "is_system": True,
            },
            {
                "slug": "audience_segment",
                "label": "Сегмент аудитории",
                "label_en": "Audience Segment",
                "icon": "IconUsersGroup",
                "color": "#FF2D92",
                "gradient": "linear-gradient(135deg, #FF2D92, #FF64AD)",
                "sort_order": 17,
                "is_system": True,
            },
        ],
    )

    # --- Seed: 10 стандартных типов связей ---
    op.bulk_insert(
        kg_edge_type_defs,
        [
            {
                "slug": "is_part_of",
                "label": "Является частью",
                "label_en": "Is part of",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "defines",
                "label": "Определяет",
                "label_en": "Defines",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "governed_by",
                "label": "Управляется",
                "label_en": "Governed by",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "uses",
                "label": "Использует",
                "label_en": "Uses",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "depends_on",
                "label": "Зависит от",
                "label_en": "Depends on",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "owned_by",
                "label": "Принадлежит",
                "label_en": "Owned by",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "measured_by",
                "label": "Измеряется",
                "label_en": "Measured by",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "targets",
                "label": "Нацелен на",
                "label_en": "Targets",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "serves",
                "label": "Обслуживает",
                "label_en": "Serves",
                "is_directed": True,
                "is_system": True,
            },
            {
                "slug": "related_to",
                "label": "Связан с",
                "label_en": "Related to",
                "is_directed": False,
                "is_system": True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("uq_ketd_slug_company", table_name="kg_edge_type_defs")
    op.drop_table("kg_edge_type_defs")
    op.drop_index("uq_kntd_slug_company", table_name="kg_node_type_defs")
    op.drop_table("kg_node_type_defs")
