'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import { SlashCommandsExtension } from './slash-commands'
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconLink,
  IconList,
  IconListNumbers,
  IconH2,
  IconH3,
  IconListCheck,
  IconBlockquote,
  IconMinus,
  IconCode,
  IconHighlight,
} from '@tabler/icons-react'
import { useCallback, useEffect } from 'react'

import styles from './TipTapEditor.module.css'

interface TipTapEditorProps {
  content: Record<string, unknown> | null
  onChange: (json: Record<string, unknown>) => void
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void
  editable?: boolean
  accentGradient?: string
  placeholder?: string
  borderless?: boolean
}

function ToolbarButton({
  icon: Icon,
  active,
  onClick,
  size = 16,
  title,
}: {
  icon: typeof IconBold
  active?: boolean
  onClick: () => void
  size?: number
  title: string
}) {
  return (
    <button
      type="button"
      className={`${styles.toolbarBtn} ${active ? styles.toolbarBtnActive : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      <Icon size={size} stroke={1.8} />
    </button>
  )
}

export function TipTapEditor({
  content,
  onChange,
  onEditorReady,
  editable = true,
  accentGradient,
  placeholder = 'Начните описывать этот узел...',
  borderless = false,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Typography,
      SlashCommandsExtension,
    ],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON() as Record<string, unknown>)
    },
  })

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor)
  }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor) return
    const currentJson = JSON.stringify(editor.getJSON())
    const newJson = JSON.stringify(content ?? { type: 'doc', content: [{ type: 'paragraph' }] })
    if (currentJson !== newJson) {
      editor.commands.setContent(content ?? { type: 'doc', content: [{ type: 'paragraph' }] })
    }
  }, [content, editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', prev ?? '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  if (!editor) return null

  const cssVars = accentGradient
    ? ({ '--tiptap-accent-gradient': accentGradient } as React.CSSProperties)
    : undefined

  return (
    <div className={styles.wrapper} style={cssVars}>
      {editable && (
        <div className={`${styles.toolbar} ${borderless ? styles.toolbarBorderless : ''}`}>
          <ToolbarButton icon={IconH2} title="Заголовок 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
          <ToolbarButton icon={IconH3} title="Заголовок 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
          <div className={styles.divider} />
          <ToolbarButton icon={IconList} title="Маркированный список" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
          <ToolbarButton icon={IconListNumbers} title="Нумерованный список" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
          <ToolbarButton icon={IconListCheck} title="Чеклист" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
          <div className={styles.divider} />
          <ToolbarButton icon={IconBlockquote} title="Цитата" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
          <ToolbarButton icon={IconMinus} title="Разделитель" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
          <ToolbarButton icon={IconCode} title="Блок кода" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        </div>
      )}

      {editable && (
        <BubbleMenu
          editor={editor}
          className={styles.bubbleMenu}
        >
          <ToolbarButton icon={IconBold} title="Жирный (⌘B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
          <ToolbarButton icon={IconItalic} title="Курсив (⌘I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <ToolbarButton icon={IconUnderline} title="Подчёркнутый (⌘U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
          <div className={styles.divider} />
          <ToolbarButton icon={IconHighlight} title="Выделение" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} />
          <ToolbarButton icon={IconCode} title="Код" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />
          <div className={styles.divider} />
          <ToolbarButton icon={IconLink} title="Ссылка" active={editor.isActive('link')} onClick={setLink} />
        </BubbleMenu>
      )}

      <div className={`${styles.editorArea} ${borderless ? styles.editorAreaBorderless : ''}`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
