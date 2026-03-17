"""Anthropic tool definitions for knowledge graph actions."""

from __future__ import annotations

KNOWLEDGE_TOOLS: list[dict] = [
    {
        "name": "create_node",
        "description": ("Propose creating a new knowledge graph node. The user must confirm before it is applied."),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Node title"},
                "node_type_def_id": {
                    "type": "integer",
                    "description": "ID of the node type definition (from get_workspace_overview)",
                },
                "content": {
                    "type": "string",
                    "description": "Plain text content for the node",
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "update_node",
        "description": ("Propose updating an existing knowledge graph node. Reference by ID from context."),
        "input_schema": {
            "type": "object",
            "properties": {
                "node_id": {
                    "type": "integer",
                    "description": "ID of the node to update (from context)",
                },
                "title": {"type": "string", "description": "New title"},
                "content": {"type": "string", "description": "New content as plain text"},
            },
            "required": ["node_id"],
        },
    },
    {
        "name": "create_edge",
        "description": "Propose creating a connection between two knowledge graph nodes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "source_id": {"type": "integer", "description": "Source node ID"},
                "target_id": {"type": "integer", "description": "Target node ID"},
                "label": {"type": "string", "description": "Relationship label"},
            },
            "required": ["source_id", "target_id", "label"],
        },
    },
]

READ_TOOLS: list[dict] = [
    {
        "name": "search_knowledge_nodes",
        "description": (
            "Search knowledge nodes by text query, type, or scope. "
            "Returns matching nodes with titles and content previews."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search text (matches title and content). Optional if filtering by type.",
                },
                "node_type_def_id": {
                    "type": "integer",
                    "description": "Filter by node type definition ID (from get_workspace_overview)",
                },
                "workspace_id": {
                    "type": "integer",
                    "description": "Filter by workspace. Omit to search current workspace from page context.",
                },
                "company_id": {
                    "type": "integer",
                    "description": "Filter by company scope nodes",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 10, max 30)",
                },
            },
        },
    },
    {
        "name": "get_node_with_edges",
        "description": (
            "Get full details of a specific knowledge node including its content "
            "and all connections (edges) to other nodes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "node_id": {
                    "type": "integer",
                    "description": "ID of the node to retrieve",
                },
            },
            "required": ["node_id"],
        },
    },
    {
        "name": "get_workspace_overview",
        "description": (
            "Get a summary of all knowledge in a workspace: node counts by type, "
            "list of node titles, and edge count. Use this to understand what "
            "knowledge exists before searching for specifics."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "workspace_id": {
                    "type": "integer",
                    "description": "Workspace ID. Omit to use current workspace from page context.",
                },
            },
        },
    },
    {
        "name": "search_across_workspaces",
        "description": (
            "Search knowledge nodes across ALL workspaces the user has access to. "
            "Use when the user asks about information that might be in other workspaces."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search text",
                },
                "node_type_def_id": {
                    "type": "integer",
                    "description": "Filter by node type definition ID",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 10, max 30)",
                },
            },
            "required": ["query"],
        },
    },
]

READ_TOOL_NAMES: set[str] = {t["name"] for t in READ_TOOLS}

ALL_TOOLS: list[dict] = READ_TOOLS + KNOWLEDGE_TOOLS

TOOLS_SYSTEM_PROMPT = (
    "\n\nYou have two types of tools:"
    "\n\n**READ tools** (executed automatically, no confirmation needed):"
    "\n- search_knowledge_nodes — search nodes by text, type, or scope"
    "\n- get_node_with_edges — get full node details with connections"
    "\n- get_workspace_overview — get summary of all knowledge in a workspace"
    "\n- search_across_workspaces — search across all accessible workspaces"
    "\n\n**WRITE tools** (require user confirmation before applying):"
    "\n- create_node — propose creating a new knowledge node"
    "\n- update_node — propose updating an existing node"
    "\n- create_edge — propose creating a connection between nodes"
    "\n\n## ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА ИСПОЛЬЗОВАНИЯ TOOLS"
    "\n\n### Slash-команды (ВСЕГДА вызывай tool):"
    "\n- /overview или «обзор воркспейса» → ОБЯЗАТЕЛЬНО вызови get_workspace_overview"
    "\n- /search [текст] или «найди/поищи» → ОБЯЗАТЕЛЬНО вызови search_knowledge_nodes"
    "\n- /find-all [текст] или «найди везде/во всех воркспейсах» → ОБЯЗАТЕЛЬНО вызови search_across_workspaces"
    "\n- /connections [текст] → ОБЯЗАТЕЛЬНО вызови search_knowledge_nodes, затем get_node_with_edges для найденных узлов"
    "\n\n### Главное правило:"
    "\nНИКОГДА не отвечай на вопросы о базе знаний, узлах, контенте или данных воркспейса без вызова READ tools."
    "\nТы НЕ ЗНАЕШЬ что находится в базе знаний — ВСЕГДА используй tools чтобы получить актуальные данные."
    "\nДаже если тебе кажется что ты знаешь ответ из контекста — ВСЕГДА проверяй через tools."
    "\n\n### Когда ОБЯЗАТЕЛЬНО вызывать tools:"
    "\n- Любой вопрос о содержимом базы знаний → search_knowledge_nodes или get_workspace_overview"
    "\n- Вопрос «что есть в воркспейсе/базе знаний» → get_workspace_overview"
    "\n- Вопрос о конкретном узле → get_node_with_edges"
    "\n- Вопрос о связях между узлами → get_node_with_edges"
    "\n- Просьба найти информацию → search_knowledge_nodes"
    "\n- Просьба проанализировать знания → get_workspace_overview + search_knowledge_nodes"
    "\n\nUse WRITE tools when the user asks to create, update, or connect nodes. "
    "Always explain what you propose before using a WRITE tool."
)
