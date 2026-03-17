import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from '@tiptap/suggestion'
import { SlashCommandsList, type SlashCommandItem } from './SlashCommandsList'

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: 'Текст',
    description: 'Обычный параграф',
    icon: 'paragraph',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    },
  },
  {
    title: 'Заголовок 2',
    description: 'Крупный заголовок',
    icon: 'h2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
  },
  {
    title: 'Заголовок 3',
    description: 'Средний заголовок',
    icon: 'h3',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
  },
  {
    title: 'Маркированный список',
    description: 'Список с точками',
    icon: 'bulletList',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Нумерованный список',
    description: 'Список с цифрами',
    icon: 'orderedList',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Чеклист',
    description: 'Список с галочками',
    icon: 'taskList',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: 'Цитата',
    description: 'Выделенная цитата',
    icon: 'blockquote',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run()
    },
  },
  {
    title: 'Разделитель',
    description: 'Горизонтальная линия',
    icon: 'horizontalRule',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  {
    title: 'Блок кода',
    description: 'Моноширинный блок',
    icon: 'codeBlock',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run()
    },
  },
  {
    title: 'Выделение',
    description: 'Маркер текста',
    icon: 'highlight',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight().run()
    },
  },
]

export const SlashCommandsExtension = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        items: ({ query }: { query: string }) => {
          return SLASH_COMMANDS.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          )
        },
        render: () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let component: ReactRenderer<any> | null = null

          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              component = new ReactRenderer(SlashCommandsList, {
                props,
                editor: props.editor,
              })

              const el = component.element
              if (el && props.clientRect) {
                document.body.appendChild(el)
                const rect = props.clientRect()
                if (rect) {
                  const htmlEl = el as HTMLElement
                  htmlEl.style.position = 'fixed'
                  htmlEl.style.left = `${rect.left}px`
                  htmlEl.style.top = `${rect.bottom + 4}px`
                  htmlEl.style.zIndex = '9999'
                }
              }
            },

            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
              component?.updateProps(props)

              if (component?.element && props.clientRect) {
                const rect = props.clientRect()
                if (rect) {
                  const htmlEl = component.element as HTMLElement
                  htmlEl.style.left = `${rect.left}px`
                  htmlEl.style.top = `${rect.bottom + 4}px`
                }
              }
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                component?.destroy()
                component?.element?.remove()
                component = null
                return true
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (component?.ref as any)?.onKeyDown?.(props.event) ?? false
            },

            onExit: () => {
              component?.destroy()
              component?.element?.remove()
              component = null
            },
          }
        },
      } satisfies Partial<SuggestionOptions<SlashCommandItem>>,
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
