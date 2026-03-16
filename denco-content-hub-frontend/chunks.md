# AI Assistant UX Improvements — Chunks

## Текущее состояние

**Бэкенд** уже шлёт SSE event `tool_progress` с именем тула при каждом вызове READ-инструмента (line 91, 318-319 в `chat_service.py`).
**Фронтенд** полностью игнорирует `tool_progress` — в `SSEEvent` type нет этого значения, в обработчике нет ветки.

`include_company_knowledge` — уже удалён из всего кода. ✅ Ничего делать не нужно.

4 READ-инструмента на бэкенде:
- `search_knowledge_nodes` — поиск нод по тексту/типу/скоупу
- `get_node_with_edges` — детали ноды + связи
- `get_workspace_overview` — обзор воркспейса (counts by type)
- `search_across_workspaces` — поиск по всем воркспейсам

---

## Chunk 1 — Tool Progress UI

**Цель**: Показывать пользователю что AI делает во время поиска в базе знаний — какой инструмент вызван, с анимацией.

### Фронтенд

| Файл | Что делать |
|------|-----------|
| `src/hooks/useAiChat.ts` | 1) Добавить `'tool_progress'` в `SSEEvent.type` union. 2) Новый стейт `toolProgress: string[]` (массив tool names в текущем стриме). 3) При `tool_progress` event — `setToolProgress(prev => [...prev, event.tool])`. 4) При первом `token` или `done` — `setToolProgress([])`. 5) Экспортировать `toolProgress` из хука. |
| `src/components/ai/AiToolProgress.tsx` | **Новый**. Props: `tools: string[]`. Маппинг tool name → текст + иконка Tabler: `search_knowledge_nodes` → IconSearch + "Ищу ноды по запросу...", `get_workspace_overview` → IconChartBar + "Загружаю обзор воркспейса...", `get_node_with_edges` → IconLink + "Загружаю связи узла...", `search_across_workspaces` → IconWorld + "Ищу по всем воркспейсам...". Каждый tool — отдельная строка с пульсирующей иконкой. |
| `src/components/ai/AiToolProgress.module.css` | Анимация: `pulse` на иконке (scale 0.9→1.1), `fadeIn` на строке. Стили: мелкий текст (12px), dimmed color, gap 4px. |
| `src/components/ai/AiChatMessage.tsx` | В `AiStreamingMessage`: добавить prop `toolProgress?: string[]`. Рендерить `<AiToolProgress>` ПЕРЕД typing indicator / content. Показывать tool progress даже когда `content` уже есть (tools могут вызываться между текстовыми блоками). |
| `src/components/ai/AiAssistantPanel.tsx` | Прокинуть `toolProgress` из `useAiChat` в `AiStreamingMessage`. |

### Бэкенд

| Файл | Что делать |
|------|-----------|
| `app/services/chat_service.py` | 1) В `_stream_anthropic`: завести `tool_rounds_count = 0`, инкрементировать при каждом раунде tool loop. 2) После цикла — `yield {"type": "tool_rounds_done", "count": tool_rounds_count}` если count > 0. 3) В `stream_chat`: обработать `tool_rounds_done` event — включить `tool_rounds` в финальный `done` SSE event. |

---

## Chunk 2 — Tool Rounds Badge + Message Animations

**Цель**: На финальном сообщении ассистента — бейдж "N поисков". Улучшить анимации появления сообщений.

### Фронтенд

| Файл | Что делать |
|------|-----------|
| `src/hooks/useAiChat.ts` | 1) Расширить `ChatMessage`: `tool_rounds?: number`. 2) Новая переменная `toolRoundsCount` в sendMessage scope (инкрементируется при каждом `tool_progress`). 3) При `done` event — записать `tool_rounds: toolRoundsCount` в `assistantMessage`. |
| `src/components/ai/AiChatMessage.tsx` | В `AiChatMessageItem` для assistant: если `message.tool_rounds > 0` — `<Badge size="xs" variant="light" color="gray">` с текстом `IconSearch + "${n} поиск(ов)"` рядом с `.time`. Pluralize: 1 поиск, 2-4 поиска, 5+ поисков. |
| `src/components/ai/AiChatMessage.module.css` | 1) Стили для `.toolRoundsBadge` (inline-flex, рядом с timestamp, gap 4px). 2) Заменить `fadeIn` анимацию на более выразительную `slideUp` (translateY(8px) → 0, opacity 0→1, 300ms ease-out). |

### Бэкенд — не нужен

Подсчёт `tool_rounds` можно делать на фронтенде по количеству `tool_progress` events (без дублирования: считать уникальные раунды). Бэкенд изменения из Chunk 1 (`tool_rounds_done`) дадут точное число, но можно обойтись и без них — фронтенд считает кол-во `tool_progress` events.

**Решение**: считать на фронтенде. Бэкенд не трогаем.

---

## Chunk 3 — Быстрые команды в чате

**Цель**: При вводе `/` — dropdown с шаблонами команд. Дополнительная suggestion card "Найти по всем воркспейсам".

### Фронтенд

| Файл | Что делать |
|------|-----------|
| `src/components/ai/AiQuickCommands.tsx` | **Новый**. Props: `query: string, onSelect: (text: string) => void, onClose: () => void`. Список команд: `/search [запрос]` (IconSearch, "Поиск нод"), `/overview` (IconChartBar, "Обзор воркспейса"), `/find-all [запрос]` (IconWorld, "Поиск по всем воркспейсам"), `/connections [ID ноды]` (IconLink, "Связи конкретной ноды"). Фильтровать по `query` (если ввели `/se` — показать только `/search`). Навигация стрелками + Enter. |
| `src/components/ai/AiQuickCommands.module.css` | Dropdown: absolute position, bottom: 100%, тёмный фон (--bg-secondary), border, border-radius 8px, max-height 200px. Элемент: padding 8px 12px, hover background, иконка + текст + описание. Активный элемент — выделение. |
| `src/components/ai/AiChatInput.tsx` | 1) Стейт `showCommands: boolean` + `commandQuery: string`. 2) При onChange: если value начинается с `/` и нет пробела после первого слова — `setShowCommands(true), setCommandQuery(value)`. Иначе — `setShowCommands(false)`. 3) При выборе команды — подставить текст (напр. "Найди все ноды типа target_audience" для `/search`), `setShowCommands(false)`. 4) При Escape — `setShowCommands(false)`. 5) Стрелки вверх/вниз — передать в `AiQuickCommands`. |
| `src/components/ai/AiSuggestionCards.tsx` | Добавить 5-ю карточку: IconWorld + "Найти по всем воркспейсам" → отправить "Найди информацию по всем моим воркспейсам". |

**Как работают команды**: Это НЕ специальная обработка на бэкенде. Команда подставляет шаблон естественного текста в textarea, который отправляется как обычное сообщение. AI сам решает какой tool вызвать.

Шаблоны подстановки:
- `/search` → "Найди ноды по запросу: " (курсор в конце)
- `/overview` → "Покажи обзор текущего воркспейса" (отправить сразу)
- `/find-all` → "Найди по всем моим воркспейсам: " (курсор в конце)
- `/connections` → "Покажи связи ноды #" (курсор в конце)

---

## Порядок реализации

```
Chunk 1 (Tool Progress UI)         — ключевая фича, самая высокая ценность
Chunk 2 (Rounds Badge + Animations) — зависит от Chunk 1 (использует toolProgress стейт)
Chunk 3 (Quick Commands)            — независимый, можно параллельно с Chunk 2
```

## Итого

- **3 чанка** (`include_company_knowledge` уже удалён — skip)
- **~5 файлов изменить**, **~4 новых файла** (+ 2 css module)
- **Бэкенд**: опциональное расширение `done` event (можно обойтись фронтенд-подсчётом)
- **Фронтенд**: основная работа — обработка `tool_progress` SSE event + новые компоненты
