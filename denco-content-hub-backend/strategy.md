# Strategy: AI Assistant — Tool-Based Knowledge Access + Prompt Caching

> Sprint 9 — Backend. Дата: 2026-03-14

---

## Проблема

Сейчас AI ассистент при каждом запросе:
1. Загружает ВСЕ ноды текущего воркспейса (до 50) в system prompt → **дорого по токенам**
2. Не видит edges (связи между нодами) → **теряет структуру графа**
3. Не может искать по другим воркспейсам → **ограничен одним контекстом**
4. System prompt пересоздаётся каждый раз без кеширования → **нет экономии на повторных запросах**

## Решение

1. **Убрать flat dump** нод из system prompt
2. **Добавить READ tools** — AI сам решает, когда и что читать из БД
3. **Server-side tool loop** — READ tools исполняются на сервере, результат возвращается в AI автоматически
4. **Prompt Caching** — system prompt кешируется через Anthropic `cache_control`

---

## Архитектурные решения

### 1. Два типа tools: READ (серверные) vs WRITE (клиентские)

**READ tools** (новые) — исполняются на сервере в цикле:
- AI вызывает tool → сервер исполняет запрос к БД → результат вставляется как `tool_result` → AI продолжает
- Пользователь видит только итоговый ответ (опционально: индикатор "AI ищет...")
- Не требуют подтверждения

**WRITE tools** (существующие: `create_node`, `update_node`, `create_edge`) — без изменений:
- AI предлагает → фронтенд показывает карточку → пользователь подтверждает/отклоняет
- SSE event `type: "action"` как сейчас

**Реализация цикла**: после получения tool_use от Anthropic, если это READ tool:
1. Исполнить запрос к БД
2. Добавить `tool_result` в messages
3. Сделать повторный вызов API (без стриминга промежуточных tool calls)
4. Стримить финальный текстовый ответ клиенту
5. Лимит: макс 5 tool calls за один запрос (защита от зацикливания)

### 2. Prompt Caching

Anthropic API поддерживает `cache_control` на блоках system prompt.
Статическая часть (master prompt + tool instructions) кешируется.

**Было** (строка):
```python
kwargs = {"system": system_prompt, ...}
```

**Станет** (список блоков):
```python
kwargs = {
    "system": [
        {
            "type": "text",
            "text": static_system_prompt,
            "cache_control": {"type": "ephemeral"}
        },
        {
            "type": "text",
            "text": dynamic_context  # page_context metadata, если есть
        }
    ],
    ...
}
```

Кешируется: master prompt + tool instructions (~стабильная часть).
Не кешируется: динамический контекст страницы (workspace_id, company_id — маленький).

### 3. Что останется в system prompt (вместо flat dump)

Вместо загрузки всех нод — **краткий контекст страницы**:
```
Current page context:
- Workspace: "Marketing Q1" (id=5, company_id=2)
- Company: "DENCO" (id=2)

Use search_knowledge_nodes and get_node_with_edges tools to find relevant knowledge.
Do NOT guess node content — always use tools to look up actual data.
```

Это даёт AI контекст "где находится пользователь" без загрузки данных.

### 4. Безопасность: scope isolation

READ tools получают `user_id` и проверяют доступ:
- `search_knowledge_nodes` — только ноды воркспейсов, к которым у юзера есть доступ
- `get_node_with_edges` — проверка membership через workspace/company
- `search_across_workspaces` — ищет только по доступным воркспейсам юзера
- `get_workspace_overview` — проверка membership

Для этого нужен доступ к workspace_member / company_member при исполнении tools.

---

## READ Tools — Спецификация

### Tool 1: `search_knowledge_nodes`

```json
{
  "name": "search_knowledge_nodes",
  "description": "Search knowledge nodes by text query, type, or scope. Returns matching nodes with titles and content previews.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search text (matches title and content). Optional if filtering by type."
      },
      "node_type": {
        "type": "string",
        "enum": ["target_audience", "meaning", "channel", "funnel", "competitor", "seo", "brand", "note"],
        "description": "Filter by node type"
      },
      "workspace_id": {
        "type": "integer",
        "description": "Filter by workspace. Omit to search current workspace from page context."
      },
      "company_id": {
        "type": "integer",
        "description": "Filter by company scope nodes"
      },
      "limit": {
        "type": "integer",
        "description": "Max results (default 10, max 30)"
      }
    }
  }
}
```

**Возвращает**: JSON-список `[{id, title, node_type, content_preview (first 200 chars), workspace_id, company_id}]`

### Tool 2: `get_node_with_edges`

```json
{
  "name": "get_node_with_edges",
  "description": "Get full details of a specific knowledge node including its content and all connections (edges) to other nodes.",
  "input_schema": {
    "type": "object",
    "properties": {
      "node_id": {
        "type": "integer",
        "description": "ID of the node to retrieve"
      }
    },
    "required": ["node_id"]
  }
}
```

**Возвращает**: `{id, title, node_type, content_text (полный), edges: [{id, label, connected_node_id, connected_node_title, connected_node_type, direction: "outgoing"|"incoming"}]}`

### Tool 3: `get_workspace_overview`

```json
{
  "name": "get_workspace_overview",
  "description": "Get a summary of all knowledge in a workspace: node counts by type, list of node titles, and edge count. Use this to understand what knowledge exists before searching for specifics.",
  "input_schema": {
    "type": "object",
    "properties": {
      "workspace_id": {
        "type": "integer",
        "description": "Workspace ID. Omit to use current workspace from page context."
      }
    }
  }
}
```

**Возвращает**: `{workspace_id, workspace_name, total_nodes, total_edges, nodes_by_type: {target_audience: 3, ...}, node_list: [{id, title, type}]}`

### Tool 4: `search_across_workspaces`

```json
{
  "name": "search_across_workspaces",
  "description": "Search knowledge nodes across ALL workspaces the user has access to. Use when the user asks about information that might be in other workspaces.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search text"
      },
      "node_type": {
        "type": "string",
        "enum": ["target_audience", "meaning", "channel", "funnel", "competitor", "seo", "brand", "note"]
      },
      "limit": {
        "type": "integer",
        "description": "Max results (default 10, max 30)"
      }
    },
    "required": ["query"]
  }
}
```

**Возвращает**: `[{id, title, node_type, content_preview, workspace_id, workspace_name, company_id}]`

---

## Chunks

### Chunk 1: Repository — новые методы для READ tools

**Файлы**:
- `app/repositories/knowledge_node_repository.py` — 3 новых метода
- `app/repositories/knowledge_edge_repository.py` — 1 новый метод

**Новые методы в KnowledgeNodeRepository**:
```python
async def search_nodes(
    self,
    search: str | None,
    node_type: NodeType | None,
    workspace_ids: list[int] | None,  # для scope isolation
    company_ids: list[int] | None,
    workspace_id: int | None = None,  # фильтр по конкретному
    company_id: int | None = None,
    limit: int = 10,
) -> list[KnowledgeNode]:
    """Full-text search across allowed scopes."""

async def get_workspace_overview(
    self, workspace_id: int,
) -> dict:
    """Node counts by type + node list for overview."""

async def search_across_workspaces(
    self,
    search: str,
    workspace_ids: list[int],  # только доступные
    node_type: NodeType | None = None,
    limit: int = 10,
) -> list[tuple[KnowledgeNode, str]]:
    """Search with workspace name join."""
```

**Новый метод в KnowledgeEdgeRepository**:
```python
async def get_edges_for_node(self, node_id: int) -> list[dict]:
    """Get edges with connected node info (title, type) for a single node."""
```

**Зависимости**: нет (чисто DB-уровень)

---

### Chunk 2: Tool definitions + tool executor

**Файлы**:
- `app/utils/ai_tools.py` — добавить READ_TOOLS, обновить TOOLS_SYSTEM_PROMPT
- `app/services/tool_executor.py` — **новый файл**, исполнение READ tools

**`app/utils/ai_tools.py`** — изменения:
- Добавить `READ_TOOLS: list[dict]` — 4 определения из спецификации выше
- `ALL_TOOLS = READ_TOOLS + KNOWLEDGE_TOOLS` (WRITE tools не трогаем)
- `READ_TOOL_NAMES: set[str]` — для быстрой проверки "это READ или WRITE tool?"
- Обновить `TOOLS_SYSTEM_PROMPT` — объяснить AI когда использовать какие tools

**`app/services/tool_executor.py`** — новый файл (~100 строк):
```python
async def execute_read_tool(
    db: AsyncSession,
    tool_name: str,
    tool_input: dict,
    user_id: int,
    page_context: dict | None,
) -> str:
    """Execute a READ tool and return JSON result string."""
```

Логика:
- `match tool_name:` → вызов соответствующего repo метода
- Scope isolation: получаем workspace_ids/company_ids юзера из WorkspaceMemberRepository
- Возвращает JSON-строку (результат tool вставляется в messages как text)

**Зависимости**: Chunk 1 (repo методы)

---

### Chunk 3: Chat service — tool loop + prompt caching

**Файлы**:
- `app/services/chat_service.py` — основные изменения

**Изменения**:

1. **Убрать `_build_context()`** — больше не нужна (заменяется на tools)
2. **Убрать `_format_nodes()`** — больше не нужна

3. **Новая функция `_build_page_context_text()`**:
```python
def _build_page_context_text(page_context: dict | None) -> str:
    """Краткий текст о текущей странице пользователя (без данных)."""
```

4. **Изменить `_stream_anthropic()`**:
- `system` parameter → список блоков с `cache_control`
- Добавить tool loop: если получили READ tool_use → execute → добавить tool_result → повторный API call
- Лимит 5 итераций tool loop
- Yield SSE event `type: "tool_progress"` чтобы фронтенд показал "AI ищет..."
- WRITE tools по-прежнему yield как `type: "action"`

5. **Изменить `stream_chat()`**:
- Убрать вызов `_build_context()`
- Tools ВСЕГДА включены (не зависят от наличия knowledge контекста)
- Передать `db`, `user_id`, `page_context` в `_stream_anthropic` для tool execution

**Сигнатура `_stream_anthropic` станет**:
```python
async def _stream_anthropic(
    messages: list[dict],
    system_prompt: str,        # статическая часть (кешируется)
    dynamic_context: str,      # page context (не кешируется)
    model: str,
    tools: list[dict],
    db: AsyncSession,          # для tool execution
    user_id: int,              # для scope isolation
    page_context: dict | None, # для default workspace/company
    max_tool_rounds: int = 5,
) -> AsyncIterator[dict[str, Any]]:
```

**Tool loop pseudocode**:
```python
while tool_rounds < max_tool_rounds:
    response = await client.messages.create(**kwargs)  # НЕ stream для tool rounds

    if response has text blocks → yield text chunks
    if response has tool_use blocks:
        for tool_use in tool_use_blocks:
            if tool_use.name in READ_TOOL_NAMES:
                result = await execute_read_tool(db, tool_use.name, tool_use.input, ...)
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": ..., "content": result}]})
                yield {"type": "tool_progress", "tool": tool_use.name}
                tool_rounds += 1
                continue outer loop
            else:  # WRITE tool
                yield {"type": "tool_use", ...}  # как сейчас

    if response.stop_reason == "end_turn":
        break
```

**Prompt Caching формат**:
```python
system = [
    {
        "type": "text",
        "text": static_system_prompt,  # master_prompt + tool instructions
        "cache_control": {"type": "ephemeral"}
    },
]
if dynamic_context:
    system.append({"type": "text", "text": dynamic_context})
```

**Зависимости**: Chunk 1, Chunk 2

---

### Chunk 4: Schema + config changes

**Файлы**:
- `app/schemas/chat.py` — убрать `ai_max_context_nodes`, добавить `ai_max_tool_rounds`
- `app/services/ai_setting_service.py` — обновить ключи
- `app/config.py` — обновить дефолты

**Изменения**:

1. **`AiSettingsResponse`** / **`AiSettingsUpdate`**:
   - Убрать: `ai_max_context_nodes` (больше не нужен — нет flat dump)
   - Добавить: `ai_max_tool_rounds: int` (default 5, max 10) — лимит tool loop итераций

2. **`ChatRequest`**:
   - Убрать: `include_company_knowledge: bool` (AI сам решает через tools)

3. **`app/config.py`**:
   - Убрать: `ai_max_context_nodes`
   - Добавить: `ai_max_tool_rounds: int = 5`

4. **Новый SSE event type**: `tool_progress`
   ```json
   {"type": "tool_progress", "tool": "search_knowledge_nodes", "status": "searching"}
   ```
   Фронтенд может показать индикатор "AI ищет в базе знаний..."

**Breaking change для фронтенда**:
- Убран `include_company_knowledge` из `ChatRequest` — фронтенд должен перестать отправлять
- Убран `ai_max_context_nodes` из `AiSettingsResponse` — фронтенд settings UI нужно обновить
- Новый SSE event `tool_progress` — фронтенд должен обработать (или игнорировать)

> ⚠️ WARNING: breaking changes для hey-api кодогена. Фронтенд нужно обновить.

**Зависимости**: нет (можно параллельно с Chunk 1-2)

---

### Chunk 5: Tests

**Файлы**:
- `tests/test_ai_tools.py` — **новый файл**

**Тесты**:
1. `test_search_knowledge_nodes` — поиск по query, по type, с лимитом
2. `test_get_node_with_edges` — полные данные ноды + edges
3. `test_get_workspace_overview` — counts и node list
4. `test_search_across_workspaces` — кросс-воркспейс поиск
5. `test_tool_executor_scope_isolation` — юзер не видит чужие воркспейсы
6. `test_prompt_caching_format` — system prompt = list of blocks с cache_control
7. `test_tool_loop_limit` — не больше max_tool_rounds итераций
8. `test_write_tools_still_stream_as_actions` — create_node/update_node → SSE action events

**Зависимости**: Chunk 1-4

---

## Порядок реализации

```
Chunk 1 (repo)  ──→  Chunk 2 (tools + executor)  ──→  Chunk 3 (chat service)  ──→  Chunk 5 (tests)
                                                            ↑
Chunk 4 (schemas) ──────────────────────────────────────────┘
```

Chunk 1 и Chunk 4 можно делать параллельно.

---

## Что НЕ меняется

- WRITE tools (`create_node`, `update_node`, `create_edge`) — логика фронтенда propose/confirm/apply
- SSE event `type: "action"` — формат тот же
- Endpoints API (`/ai/chat`, `/ai/sessions`, etc.) — без изменений
- Attachments — без изменений
- Rate limiting — без изменений
- `ai_master_prompt` — содержимое не меняем (только способ передачи в API)

## Риски

| Риск | Митигация |
|------|-----------|
| Tool loop увеличивает latency (N API calls вместо 1) | Лимит 5 rounds, READ tools возвращают компактный JSON |
| Стоимость: больше API calls | Prompt caching компенсирует. READ tools экономят vs flat dump 50 нод |
| AI злоупотребляет tools (вызывает на каждый вопрос) | System prompt инструкция: "use tools only when user asks about knowledge" |
| Breaking changes фронтенда | Минимальные: убрать `include_company_knowledge`, обработать `tool_progress` |
| Scope isolation — утечка данных | Каждый tool call проверяет user membership |

## Оценка объёма

- Chunk 1: ~80 строк новых repo-методов
- Chunk 2: ~120 строк (tools defs + executor)
- Chunk 3: ~100 строк изменений в chat_service
- Chunk 4: ~20 строк schema changes
- Chunk 5: ~150 строк тестов

**Итого**: ~470 строк кода, 5 файлов новых/изменённых
