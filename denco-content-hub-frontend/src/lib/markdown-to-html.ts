import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function markdownToHtml(markdown: string): string {
  if (!markdown) return ''
  try {
    const raw = marked.parse(markdown, { async: false }) as string
    return DOMPurify.sanitize(raw)
  } catch {
    return ''
  }
}
