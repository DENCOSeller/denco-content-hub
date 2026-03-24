"""rename_company_to_organization

Revision ID: 42a0a5a45ba5
Revises: cae9c6b78bd8
Create Date: 2026-03-21 11:11:41.730354

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42a0a5a45ba5'
down_revision: Union[str, None] = 'cae9c6b78bd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # 1. Rename table: companies -> organizations
    # =========================================================================
    op.rename_table("companies", "organizations")

    # Rename PK constraint
    op.execute("ALTER INDEX companies_pkey RENAME TO organizations_pkey")
    # Rename unique index on slug
    op.execute("ALTER INDEX ix_companies_slug_active RENAME TO ix_organizations_slug_active")
    # Rename unique constraint on staff_org_id
    op.execute("ALTER INDEX companies_staff_org_id_key RENAME TO organizations_staff_org_id_key")

    # =========================================================================
    # 2. Rename table: company_members -> organization_members
    # =========================================================================
    op.rename_table("company_members", "organization_members")

    # Rename PK
    op.execute("ALTER INDEX company_members_pkey RENAME TO organization_members_pkey")

    # Rename column company_id -> organization_id in organization_members
    op.alter_column("organization_members", "company_id", new_column_name="organization_id")

    # Rename unique constraint
    op.execute("ALTER INDEX uq_company_member_user_company RENAME TO uq_org_member_user_org")
    # Rename indexes
    op.execute("ALTER INDEX ix_company_members_company_id RENAME TO ix_organization_members_organization_id")
    op.execute("ALTER INDEX ix_company_members_user_id RENAME TO ix_organization_members_user_id")

    # Rename FK constraints on organization_members
    op.execute(
        "ALTER TABLE organization_members "
        "RENAME CONSTRAINT company_members_company_id_fkey TO organization_members_organization_id_fkey"
    )
    op.execute(
        "ALTER TABLE organization_members "
        "RENAME CONSTRAINT company_members_user_id_fkey TO organization_members_user_id_fkey"
    )

    # =========================================================================
    # 3. Rename column company_id -> organization_id in workspaces
    # =========================================================================
    op.alter_column("workspaces", "company_id", new_column_name="organization_id")
    op.execute(
        "ALTER TABLE workspaces "
        "RENAME CONSTRAINT fk_workspaces_company_id TO fk_workspaces_organization_id"
    )

    # =========================================================================
    # 4. Rename column company_id -> organization_id in knowledge_nodes
    # =========================================================================
    op.alter_column("knowledge_nodes", "company_id", new_column_name="organization_id")
    op.execute(
        "ALTER TABLE knowledge_nodes "
        "RENAME CONSTRAINT knowledge_nodes_company_id_fkey TO knowledge_nodes_organization_id_fkey"
    )
    # Rename partial index
    op.execute("ALTER INDEX ix_kn_company RENAME TO ix_kn_organization")

    # =========================================================================
    # 5. Rename column company_id -> organization_id in kg_node_type_defs
    # =========================================================================
    op.alter_column("kg_node_type_defs", "company_id", new_column_name="organization_id")
    op.execute(
        "ALTER TABLE kg_node_type_defs "
        "RENAME CONSTRAINT kg_node_type_defs_company_id_fkey TO kg_node_type_defs_organization_id_fkey"
    )
    # Rename unique index (references company_id in expression, but index name is enough)
    op.execute("ALTER INDEX uq_kntd_slug_company RENAME TO uq_kntd_slug_organization")

    # =========================================================================
    # 6. Rename column company_id -> organization_id in kg_edge_type_defs
    # =========================================================================
    op.alter_column("kg_edge_type_defs", "company_id", new_column_name="organization_id")
    op.execute(
        "ALTER TABLE kg_edge_type_defs "
        "RENAME CONSTRAINT kg_edge_type_defs_company_id_fkey TO kg_edge_type_defs_organization_id_fkey"
    )
    op.execute("ALTER INDEX uq_ketd_slug_company RENAME TO uq_ketd_slug_organization")

    # =========================================================================
    # 7. Update check constraint expression on knowledge_nodes
    #    (the column name changed, but the check constraint expression
    #     is stored with the old column name — need to recreate)
    # =========================================================================
    op.execute("ALTER TABLE knowledge_nodes DROP CONSTRAINT ck_knowledge_nodes_scope")
    op.execute(
        "ALTER TABLE knowledge_nodes ADD CONSTRAINT ck_knowledge_nodes_scope "
        "CHECK ("
        "(organization_id IS NOT NULL AND workspace_id IS NULL) OR "
        "(organization_id IS NULL AND workspace_id IS NOT NULL)"
        ")"
    )


def downgrade() -> None:
    # =========================================================================
    # Reverse: organization -> company
    # =========================================================================

    # 7. Restore check constraint with company_id
    op.execute("ALTER TABLE knowledge_nodes DROP CONSTRAINT ck_knowledge_nodes_scope")
    op.execute(
        "ALTER TABLE knowledge_nodes ADD CONSTRAINT ck_knowledge_nodes_scope "
        "CHECK ("
        "(company_id IS NOT NULL AND workspace_id IS NULL) OR "
        "(company_id IS NULL AND workspace_id IS NOT NULL)"
        ")"
    )

    # 6. kg_edge_type_defs
    op.execute("ALTER INDEX uq_ketd_slug_organization RENAME TO uq_ketd_slug_company")
    op.execute(
        "ALTER TABLE kg_edge_type_defs "
        "RENAME CONSTRAINT kg_edge_type_defs_organization_id_fkey TO kg_edge_type_defs_company_id_fkey"
    )
    op.alter_column("kg_edge_type_defs", "organization_id", new_column_name="company_id")

    # 5. kg_node_type_defs
    op.execute("ALTER INDEX uq_kntd_slug_organization RENAME TO uq_kntd_slug_company")
    op.execute(
        "ALTER TABLE kg_node_type_defs "
        "RENAME CONSTRAINT kg_node_type_defs_organization_id_fkey TO kg_node_type_defs_company_id_fkey"
    )
    op.alter_column("kg_node_type_defs", "organization_id", new_column_name="company_id")

    # 4. knowledge_nodes
    op.execute("ALTER INDEX ix_kn_organization RENAME TO ix_kn_company")
    op.execute(
        "ALTER TABLE knowledge_nodes "
        "RENAME CONSTRAINT knowledge_nodes_organization_id_fkey TO knowledge_nodes_company_id_fkey"
    )
    op.alter_column("knowledge_nodes", "organization_id", new_column_name="company_id")

    # 3. workspaces
    op.execute(
        "ALTER TABLE workspaces "
        "RENAME CONSTRAINT fk_workspaces_organization_id TO fk_workspaces_company_id"
    )
    op.alter_column("workspaces", "organization_id", new_column_name="company_id")

    # 2. organization_members -> company_members
    op.execute(
        "ALTER TABLE organization_members "
        "RENAME CONSTRAINT organization_members_user_id_fkey TO company_members_user_id_fkey"
    )
    op.execute(
        "ALTER TABLE organization_members "
        "RENAME CONSTRAINT organization_members_organization_id_fkey TO company_members_company_id_fkey"
    )
    op.execute("ALTER INDEX ix_organization_members_user_id RENAME TO ix_company_members_user_id")
    op.execute("ALTER INDEX ix_organization_members_organization_id RENAME TO ix_company_members_company_id")
    op.execute("ALTER INDEX uq_org_member_user_org RENAME TO uq_company_member_user_company")
    op.alter_column("organization_members", "organization_id", new_column_name="company_id")
    op.execute("ALTER INDEX organization_members_pkey RENAME TO company_members_pkey")
    op.rename_table("organization_members", "company_members")

    # 1. organizations -> companies
    op.execute("ALTER INDEX organizations_staff_org_id_key RENAME TO companies_staff_org_id_key")
    op.execute("ALTER INDEX ix_organizations_slug_active RENAME TO ix_companies_slug_active")
    op.execute("ALTER INDEX organizations_pkey RENAME TO companies_pkey")
    op.rename_table("organizations", "companies")
