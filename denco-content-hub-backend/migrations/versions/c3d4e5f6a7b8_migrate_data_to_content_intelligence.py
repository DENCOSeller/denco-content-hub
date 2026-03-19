"""migrate data to content_intelligence

Revision ID: c3d4e5f6a7b8
Revises: fca9e7d7aeaf
Create Date: 2026-03-19 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "fca9e7d7aeaf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # === 1. content_analyses → content_intelligence (source_type='reference') ===
    op.execute("""
        INSERT INTO content_intelligence (
            workspace_id,
            content_item_id,
            source_type,
            summary,
            key_points,
            hooks,
            storyboard,
            content_ideas,
            audience_insights,
            production_notes,
            status,
            error_message,
            model_used,
            prompt_version,
            sections_requested,
            topics,
            tone,
            quality_score,
            content_structure,
            created_at,
            updated_at
        )
        SELECT
            ci.workspace_id,
            ca.content_item_id,
            'reference',
            ca.summary,
            -- theses: [{title, description}] → [{point: title||description, importance: description}]
            CASE
                WHEN ca.theses IS NOT NULL THEN (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'point', COALESCE(elem->>'title', elem->>'description', ''),
                            'importance', COALESCE(elem->>'description', '')
                        )
                    )
                    FROM jsonb_array_elements(ca.theses) AS elem
                )
                ELSE NULL
            END,
            -- hooks: если элемент строка → {hook: str, explanation: ""}, если dict → {hook, explanation}
            CASE
                WHEN ca.hooks IS NOT NULL THEN (
                    SELECT jsonb_agg(
                        CASE
                            WHEN jsonb_typeof(elem) = 'string' THEN
                                jsonb_build_object('hook', elem #>> '{}', 'explanation', '')
                            ELSE
                                jsonb_build_object(
                                    'hook', COALESCE(elem->>'hook', ''),
                                    'explanation', COALESCE(elem->>'explanation', '')
                                )
                        END
                    )
                    FROM jsonb_array_elements(ca.hooks) AS elem
                )
                ELSE NULL
            END,
            ca.storyboard,
            -- content_ideas: [{idea/title, angle/description}] → [{idea, angle}]
            CASE
                WHEN ca.content_ideas IS NOT NULL THEN (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'idea', COALESCE(elem->>'idea', elem->>'title', ''),
                            'angle', COALESCE(elem->>'angle', elem->>'description', '')
                        )
                    )
                    FROM jsonb_array_elements(ca.content_ideas) AS elem
                )
                ELSE NULL
            END,
            -- audience_insights: TEXT → JSONB array
            CASE
                WHEN ca.audience_insights IS NOT NULL AND ca.audience_insights != '' THEN
                    jsonb_build_array(
                        jsonb_build_object('insight', ca.audience_insights, 'recommendation', NULL)
                    )
                ELSE NULL
            END,
            -- production_notes: TEXT → JSONB array
            CASE
                WHEN ca.production_notes IS NOT NULL AND ca.production_notes != '' THEN
                    jsonb_build_array(
                        jsonb_build_object('note', ca.production_notes, 'category', NULL)
                    )
                ELSE NULL
            END,
            ca.status,
            ca.error_message,
            NULL,           -- model_used
            'legacy',       -- prompt_version
            NULL,           -- sections_requested
            NULL,           -- topics
            NULL,           -- tone
            NULL,           -- quality_score
            NULL,           -- content_structure
            ca.created_at,
            ca.updated_at
        FROM content_analyses ca
        JOIN content_items ci ON ci.id = ca.content_item_id
        WHERE NOT EXISTS (
            SELECT 1 FROM content_intelligence cint
            WHERE cint.content_item_id = ca.content_item_id
        )
    """)

    # === 2. competitor_post_analyses → content_intelligence (source_type='competitor_post') ===
    op.execute("""
        INSERT INTO content_intelligence (
            workspace_id,
            competitor_post_id,
            source_type,
            summary,
            hooks,
            key_points,
            topics,
            tone,
            quality_score,
            content_ideas,
            content_structure,
            status,
            model_used,
            prompt_version,
            sections_requested,
            storyboard,
            audience_insights,
            production_notes,
            error_message,
            created_at,
            updated_at
        )
        SELECT
            cc.workspace_id,
            cpa.post_id,
            'competitor_post',
            cpa.summary,
            cpa.hooks,
            -- key_points: нормализовать — строка → {point: str}, dict → как есть
            CASE
                WHEN cpa.key_points IS NOT NULL THEN (
                    SELECT jsonb_agg(
                        CASE
                            WHEN jsonb_typeof(elem) = 'string' THEN
                                jsonb_build_object('point', elem #>> '{}')
                            ELSE elem
                        END
                    )
                    FROM jsonb_array_elements(cpa.key_points) AS elem
                )
                ELSE NULL
            END,
            -- topics: нормализовать — строка → {name: str}, dict → как есть
            CASE
                WHEN cpa.topics IS NOT NULL THEN (
                    SELECT jsonb_agg(
                        CASE
                            WHEN jsonb_typeof(elem) = 'string' THEN
                                jsonb_build_object('name', elem #>> '{}')
                            ELSE elem
                        END
                    )
                    FROM jsonb_array_elements(cpa.topics) AS elem
                )
                ELSE NULL
            END,
            cpa.tone,
            cpa.quality_score,
            cpa.content_ideas,
            cpa.content_structure,
            'completed',    -- status
            NULL,           -- model_used
            'legacy',       -- prompt_version
            NULL,           -- sections_requested
            NULL,           -- storyboard
            NULL,           -- audience_insights
            NULL,           -- production_notes
            NULL,           -- error_message
            cpa.created_at,
            cpa.updated_at
        FROM competitor_post_analyses cpa
        JOIN competitor_posts cp ON cp.id = cpa.post_id
        JOIN competitor_channels cc ON cc.id = cp.channel_id
        WHERE NOT EXISTS (
            SELECT 1 FROM content_intelligence cint
            WHERE cint.competitor_post_id = cpa.post_id
        )
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM content_intelligence
        WHERE prompt_version = 'legacy'
    """)
