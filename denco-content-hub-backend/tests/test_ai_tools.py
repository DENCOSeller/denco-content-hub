"""Tests for AI READ tools: executor, scope isolation, workspace summary."""

from __future__ import annotations

from types import SimpleNamespace
from typing import ClassVar
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.knowledge import NodeType
from app.utils.ai_tool_executor import ReadToolExecutor

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_node(
    id: int,
    title: str,
    node_type: str = "note",
    content_text: str = "",
    workspace_id: int | None = 1,
    company_id: int | None = None,
) -> SimpleNamespace:
    """Lightweight node stub."""
    return SimpleNamespace(
        id=id,
        title=title,
        node_type=node_type,
        content_text=content_text,
        workspace_id=workspace_id,
        company_id=company_id,
    )


def _mock_scopes(workspace_ids: list[int], company_ids: list[int]) -> AsyncMock:
    """Patch _get_allowed_scopes to return fixed scopes."""
    return AsyncMock(return_value=(workspace_ids, company_ids))


# ---------------------------------------------------------------------------
# 1. search_knowledge_nodes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_knowledge_nodes():
    """search_knowledge_nodes returns compact JSON with node previews."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1, page_context={"workspace_id": 1})
    executor._get_allowed_scopes = _mock_scopes([1], [])

    nodes = [_make_node(10, "SEO Strategy", "seo", "Full content here")]
    executor._node_repo.search_nodes = AsyncMock(return_value=nodes)

    result = await executor.execute("search_knowledge_nodes", {"query": "SEO"})

    assert "nodes" in result
    assert len(result["nodes"]) == 1
    assert result["nodes"][0]["id"] == 10
    assert result["nodes"][0]["title"] == "SEO Strategy"
    assert result["nodes"][0]["node_type"] == "seo"
    # content_preview is truncated to 200 chars
    assert result["nodes"][0]["content_preview"] == "Full content here"

    executor._node_repo.search_nodes.assert_awaited_once()
    call_kwargs = executor._node_repo.search_nodes.call_args
    assert call_kwargs.kwargs["search"] == "SEO"


@pytest.mark.asyncio
async def test_search_nodes_by_type():
    """search_knowledge_nodes filters by node_type."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._get_allowed_scopes = _mock_scopes([1, 2], [])
    executor._node_repo.search_nodes = AsyncMock(return_value=[])

    await executor.execute(
        "search_knowledge_nodes",
        {"node_type": "target_audience", "limit": 5},
    )

    call_kwargs = executor._node_repo.search_nodes.call_args
    assert call_kwargs.kwargs["node_type"] == NodeType.TARGET_AUDIENCE
    assert call_kwargs.kwargs["limit"] == 5


# ---------------------------------------------------------------------------
# 2. get_node_with_edges
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_node_with_edges():
    """get_node_with_edges returns full node data + edges list."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._get_allowed_scopes = _mock_scopes([1], [])

    node = _make_node(5, "Brand Voice", "brand", "Our brand tone is warm")
    executor._node_repo.get_by_id = AsyncMock(return_value=node)

    edges = [
        {
            "id": 1,
            "label": "informs",
            "connected_node_id": 10,
            "connected_node_title": "Content Plan",
            "connected_node_type": "note",
            "direction": "outgoing",
        },
    ]
    executor._edge_repo.get_edges_for_node = AsyncMock(return_value=edges)

    result = await executor.execute("get_node_with_edges", {"node_id": 5})

    assert result["id"] == 5
    assert result["title"] == "Brand Voice"
    assert result["content_text"] == "Our brand tone is warm"
    assert len(result["edges"]) == 1
    assert result["edges"][0]["direction"] == "outgoing"


@pytest.mark.asyncio
async def test_get_node_not_found():
    """get_node_with_edges returns error when node doesn't exist."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._node_repo.get_by_id = AsyncMock(return_value=None)

    result = await executor.execute("get_node_with_edges", {"node_id": 999})
    assert result == {"error": "Node not found"}


# ---------------------------------------------------------------------------
# 3. get_workspace_overview
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_workspace_overview():
    """get_workspace_overview returns counts by type + node list."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1, page_context={"workspace_id": 3})
    executor._get_allowed_scopes = _mock_scopes([3], [])

    overview = {
        "workspace_id": 3,
        "total_nodes": 4,
        "nodes_by_type": {"seo": 2, "brand": 1, "note": 1},
        "node_list": [
            {"id": 1, "title": "SEO 1", "type": "seo"},
            {"id": 2, "title": "SEO 2", "type": "seo"},
            {"id": 3, "title": "Brand", "type": "brand"},
            {"id": 4, "title": "Notes", "type": "note"},
        ],
    }
    executor._node_repo.get_workspace_overview = AsyncMock(return_value=overview)

    result = await executor.execute("get_workspace_overview", {})

    assert result["total_nodes"] == 4
    assert result["nodes_by_type"]["seo"] == 2
    assert len(result["node_list"]) == 4


@pytest.mark.asyncio
async def test_get_workspace_overview_no_id():
    """get_workspace_overview returns error when workspace_id missing."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1, page_context={})
    executor._get_allowed_scopes = _mock_scopes([], [])

    result = await executor.execute("get_workspace_overview", {})
    assert result == {"error": "workspace_id required"}


# ---------------------------------------------------------------------------
# 4. search_across_workspaces
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_across_workspaces():
    """search_across_workspaces returns nodes with workspace_name."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._get_allowed_scopes = _mock_scopes([1, 2], [])

    node_a = _make_node(10, "Competitors", "competitor", workspace_id=1)
    node_b = _make_node(20, "Competitor Analysis", "competitor", workspace_id=2)
    executor._node_repo.search_across_workspaces = AsyncMock(
        return_value=[(node_a, "Marketing Q1"), (node_b, "Marketing Q2")],
    )

    result = await executor.execute(
        "search_across_workspaces",
        {"query": "competitor"},
    )

    assert len(result["nodes"]) == 2
    assert result["nodes"][0]["workspace_name"] == "Marketing Q1"
    assert result["nodes"][1]["workspace_name"] == "Marketing Q2"
    assert result["nodes"][0]["id"] == 10
    assert result["nodes"][1]["id"] == 20


# ---------------------------------------------------------------------------
# 5. Unknown tool
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unknown_tool():
    """Unknown tool_name returns error dict."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)

    result = await executor.execute("nonexistent_tool", {})
    assert "error" in result
    assert "Unknown tool" in result["error"]


# ---------------------------------------------------------------------------
# 6. execute_json truncation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_json_truncation():
    """execute_json truncates long results to MAX_RESULT_LEN."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._get_allowed_scopes = _mock_scopes([1], [])

    # Create nodes with long content to exceed 2000 chars
    nodes = [_make_node(i, f"Node {i}", "note", "x" * 200) for i in range(20)]
    executor._node_repo.search_nodes = AsyncMock(return_value=nodes)

    text = await executor.execute_json(
        "search_knowledge_nodes",
        {"query": "x"},
    )

    assert len(text) <= 2000
    assert text.endswith('..."truncated":true}')


# ---------------------------------------------------------------------------
# 7. Scope isolation — access denied
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scope_isolation_search():
    """User can't search nodes in a workspace they don't belong to."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._get_allowed_scopes = _mock_scopes([1], [])  # only workspace 1

    result = await executor.execute(
        "search_knowledge_nodes",
        {"query": "test", "workspace_id": 99},
    )
    assert result == {"error": "Access denied to this workspace"}


@pytest.mark.asyncio
async def test_scope_isolation_company():
    """User can't search nodes in a company they don't belong to."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._get_allowed_scopes = _mock_scopes([1], [5])  # only company 5

    result = await executor.execute(
        "search_knowledge_nodes",
        {"query": "test", "company_id": 99},
    )
    assert result == {"error": "Access denied to this company"}


@pytest.mark.asyncio
async def test_scope_isolation_node_access():
    """User can't get a node from a workspace they don't belong to."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._get_allowed_scopes = _mock_scopes([1], [])

    node = _make_node(5, "Secret", "note", workspace_id=99)
    executor._node_repo.get_by_id = AsyncMock(return_value=node)

    result = await executor.execute("get_node_with_edges", {"node_id": 5})
    assert result == {"error": "Access denied"}


@pytest.mark.asyncio
async def test_scope_isolation_overview():
    """User can't get workspace overview for a workspace they don't belong to."""
    db = AsyncMock()
    executor = ReadToolExecutor(db, user_id=1)
    executor._get_allowed_scopes = _mock_scopes([1], [])

    result = await executor.execute(
        "get_workspace_overview",
        {"workspace_id": 99},
    )
    assert result == {"error": "Access denied to this workspace"}


# ---------------------------------------------------------------------------
# 8. _build_workspace_summary — brief output
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_build_workspace_summary_brief():
    """_build_workspace_summary returns ~30 tokens, not a list of nodes."""
    from app.services.chat_service import _build_workspace_summary

    overview = {
        "workspace_id": 5,
        "total_nodes": 8,
        "nodes_by_type": {"target_audience": 3, "seo": 2, "brand": 1, "note": 2},
        "node_list": [{"id": i, "title": f"N{i}", "type": "note"} for i in range(8)],
    }

    with patch("app.services.chat_service.KnowledgeNodeRepository") as mock_repo_cls:
        mock_repo = mock_repo_cls.return_value
        mock_repo.get_workspace_overview = AsyncMock(return_value=overview)

        db = AsyncMock()
        result = await _build_workspace_summary(db, {"workspace_id": 5, "company_id": 2})

    assert "Workspace #5" in result
    assert "company_id=2" in result
    assert "search_knowledge_nodes" in result
    # Should NOT contain individual node titles — just counts
    assert "N0" not in result
    assert "N7" not in result
    # Brief: less than 300 chars total (~30 tokens)
    assert len(result) < 300


@pytest.mark.asyncio
async def test_build_workspace_summary_empty():
    """_build_workspace_summary returns empty string when no context."""
    from app.services.chat_service import _build_workspace_summary

    db = AsyncMock()
    assert await _build_workspace_summary(db, None) == ""
    assert await _build_workspace_summary(db, {}) == ""


# ---------------------------------------------------------------------------
# 9. Prompt caching format — system blocks with cache_control
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_prompt_caching_format():
    """_stream_anthropic sends system as list of blocks with cache_control."""
    captured_kwargs: dict = {}

    class _FakeResponse:
        content: ClassVar[list] = []

    class _FakeStream:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            pass

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise StopAsyncIteration

    class _FakeMessages:
        @staticmethod
        async def create(**kwargs):
            captured_kwargs.update(kwargs)
            return _FakeResponse()

        @staticmethod
        def stream(**kwargs):
            return _FakeStream()

    fake_client = SimpleNamespace(messages=_FakeMessages())

    with patch("anthropic.AsyncAnthropic", return_value=fake_client):
        from app.services.chat_service import _stream_anthropic

        executor = MagicMock()
        chunks = []
        async for chunk in _stream_anthropic(
            messages=[{"role": "user", "content": "hello"}],
            static_system="You are helpful",
            dynamic_context="Workspace #1",
            model="claude-sonnet-4-20250514",
            tools=[],
            executor=executor,
        ):
            chunks.append(chunk)

    system = captured_kwargs["system"]
    assert isinstance(system, list)
    assert len(system) == 2
    assert system[0]["cache_control"] == {"type": "ephemeral"}
    assert system[0]["text"] == "You are helpful"
    assert system[1]["text"] == "Workspace #1"
    assert "cache_control" not in system[1]


# ---------------------------------------------------------------------------
# 10. Tool loop limit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tool_loop_limit():
    """Tool loop stops after max_tool_rounds even if READ tools keep coming."""
    call_count = 0

    fake_tool = SimpleNamespace(
        type="tool_use",
        name="search_knowledge_nodes",
        id="tool_1",
        input={"query": "test"},
    )
    fake_response = SimpleNamespace(content=[fake_tool])

    class _LoopStream:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            pass

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise StopAsyncIteration

    class _LoopMessages:
        @staticmethod
        async def create(**kwargs):
            nonlocal call_count
            call_count += 1
            return fake_response

        @staticmethod
        def stream(**kwargs):
            return _LoopStream()

    fake_client = SimpleNamespace(messages=_LoopMessages())

    with patch("anthropic.AsyncAnthropic", return_value=fake_client):
        from app.services.chat_service import _stream_anthropic

        executor = MagicMock()
        executor.execute_json = AsyncMock(return_value='{"nodes": []}')

        chunks = []
        async for chunk in _stream_anthropic(
            messages=[{"role": "user", "content": "test"}],
            static_system="sys",
            dynamic_context="",
            model="claude-sonnet-4-20250514",
            tools=[],
            executor=executor,
            max_tool_rounds=3,
        ):
            chunks.append(chunk)

    # Non-streaming loop: 3 rounds (max_tool_rounds) + break
    assert call_count == 3
    # tool_progress yielded once per round
    progress = [c for c in chunks if c.get("type") == "tool_progress"]
    assert len(progress) == 3


# ---------------------------------------------------------------------------
# 11. Write tools stream as SSE actions (not auto-executed)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_write_tools_stream_as_actions():
    """create_node tool_use in final stream yields as action, not auto-executed."""

    empty_response = SimpleNamespace(content=[])

    events = [
        SimpleNamespace(
            type="content_block_start",
            content_block=SimpleNamespace(type="tool_use", id="t1", name="create_node"),
        ),
        SimpleNamespace(
            type="content_block_delta",
            delta=SimpleNamespace(partial_json='{"title":"New Node","node_type":"note"}'),
        ),
        SimpleNamespace(type="content_block_stop"),
    ]

    class _WriteStream:
        async def __aenter__(self):
            self._idx = 0
            return self

        async def __aexit__(self, *_):
            pass

        def __aiter__(self):
            return self

        async def __anext__(self):
            if self._idx >= len(events):
                raise StopAsyncIteration
            ev = events[self._idx]
            self._idx += 1
            return ev

    class _WriteMessages:
        @staticmethod
        async def create(**kwargs):
            return empty_response

        @staticmethod
        def stream(**kwargs):
            return _WriteStream()

    fake_client = SimpleNamespace(messages=_WriteMessages())

    with patch("anthropic.AsyncAnthropic", return_value=fake_client):
        from app.services.chat_service import _stream_anthropic

        executor = MagicMock()
        chunks = []
        async for chunk in _stream_anthropic(
            messages=[{"role": "user", "content": "create a note"}],
            static_system="sys",
            dynamic_context="",
            model="claude-sonnet-4-20250514",
            tools=[],
            executor=executor,
        ):
            chunks.append(chunk)

    tool_chunks = [c for c in chunks if c.get("type") == "tool_use"]
    assert len(tool_chunks) == 1
    assert tool_chunks[0]["name"] == "create_node"
    assert tool_chunks[0]["input"]["title"] == "New Node"
    # executor should NOT have been called for write tools
    executor.execute_json.assert_not_called()
