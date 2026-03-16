import type { NodeType } from './knowledge-utils'

export interface TextSegment {
  type: 'text'
  content: string
}

export interface NodeRefSegment {
  type: 'node_ref'
  id: number
  nodeType: NodeType
  title: string
}

export type MessageSegment = TextSegment | NodeRefSegment

const NODE_REF_REGEX = /\[\[node:(\d+):(\w+):([^\]]+)\]\]/g

export function parseMessageContent(text: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(NODE_REF_REGEX)) {
    const matchIndex = match.index!
    if (matchIndex > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, matchIndex) })
    }
    segments.push({
      type: 'node_ref',
      id: parseInt(match[1], 10),
      nodeType: match[2] as NodeType,
      title: match[3],
    })
    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return segments
}
