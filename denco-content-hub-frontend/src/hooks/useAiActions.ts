'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { generateJSON } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import {
  createNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesPost,
  updateNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdPatch,
  createEdgeApiV1WorkspacesWorkspaceIdKnowledgeEdgesPost,
  createNodeApiV1CompaniesCompanyIdKnowledgeNodesPost,
  updateNodeApiV1CompaniesCompanyIdKnowledgeNodesNodeIdPatch,
  createEdgeApiV1CompaniesCompanyIdKnowledgeEdgesPost,
} from '@/api/client'
import { knowledgeKeys } from '@/api/hooks/useKnowledge'
import { companyKnowledgeKeys } from '@/api/hooks/useCompanyKnowledge'
import { markdownToHtml } from '@/lib/markdown-to-html'
import type { AiAction, AiActionStatus } from './useAiChat'

const tiptapExtensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight,
  Link.configure({ openOnClick: false, autolink: true }),
]

function textToTiptap(text: string): Record<string, unknown> {
  if (!text) return { type: 'doc', content: [{ type: 'paragraph' }] }
  const html = markdownToHtml(text)
  if (!html) return { type: 'doc', content: [{ type: 'paragraph' }] }
  return generateJSON(html, tiptapExtensions) as Record<string, unknown>
}

const SUCCESS_MESSAGES: Record<string, string> = {
  create_node: 'Узел создан',
  update_node: 'Узел обновлён',
  create_edge: 'Связь создана',
}

interface UseAiActionsOptions {
  workspaceId?: number
  companyId?: number
  focusedNodeId?: number
  updateActionStatus: (messageId: string, actionId: string, status: AiActionStatus) => void
}

export function useAiActions({ workspaceId, companyId, focusedNodeId, updateActionStatus }: UseAiActionsOptions) {
  const qc = useQueryClient()

  const applyAction = useCallback(
    async (messageId: string, action: AiAction): Promise<boolean> => {
      try {
        // Guard: need workspace or company context to make API calls
        if (!workspaceId && !companyId) {
          notifications.show({
            title: 'Ошибка',
            message: 'Откройте воркспейс для применения действий',
            color: 'red',
          })
          return false
        }

        if (action.action_type === 'create_node') {
          if (!action.payload.node_type_def_id) {
            notifications.show({
              title: 'Ошибка',
              message: 'AI не указал тип узла — переформулируйте запрос',
              color: 'red',
            })
            return false
          }

          let tiptapContent: Record<string, unknown> | undefined
          if (action.payload.content) {
            try {
              tiptapContent = textToTiptap(action.payload.content as string)
            } catch {
              notifications.show({ title: 'Ошибка', message: 'Не удалось преобразовать контент', color: 'red' })
              return false
            }
          }

          const body = {
            title: action.payload.title as string,
            node_type_def_id: action.payload.node_type_def_id as number,
            content: tiptapContent,
          }

          if (workspaceId) {
            await createNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesPost({
              path: { workspace_id: workspaceId },
              body: body as never,
              throwOnError: true,
            })
            await qc.refetchQueries({ queryKey: knowledgeKeys.graph(workspaceId) })
            qc.invalidateQueries({ queryKey: knowledgeKeys.nodes(workspaceId) })
          } else if (companyId) {
            await createNodeApiV1CompaniesCompanyIdKnowledgeNodesPost({
              path: { company_id: companyId },
              body: body as never,
              throwOnError: true,
            })
            await qc.refetchQueries({ queryKey: companyKnowledgeKeys.graph(companyId) })
            qc.invalidateQueries({ queryKey: companyKnowledgeKeys.nodes(companyId) })
          }
        } else if (action.action_type === 'update_node') {
          const nodeId = focusedNodeId ?? Number(action.payload.node_id)
          if (!nodeId || isNaN(nodeId)) {
            notifications.show({ title: 'Ошибка', message: 'Не удалось определить узел для обновления', color: 'red' })
            return false
          }

          const body: Record<string, unknown> = {}
          if (action.payload.title) body.title = action.payload.title
          if (action.payload.content) {
            try {
              body.content = textToTiptap(action.payload.content as string)
            } catch {
              notifications.show({ title: 'Ошибка', message: 'Не удалось преобразовать контент', color: 'red' })
              return false
            }
          }

          if (Object.keys(body).length === 0) {
            notifications.show({ title: 'Ошибка', message: 'Нет данных для обновления', color: 'red' })
            return false
          }

          if (workspaceId) {
            await updateNodeApiV1WorkspacesWorkspaceIdKnowledgeNodesNodeIdPatch({
              path: { workspace_id: workspaceId, node_id: nodeId },
              body: body as never,
              throwOnError: true,
            })
            await qc.refetchQueries({ queryKey: knowledgeKeys.graph(workspaceId) })
            qc.invalidateQueries({ queryKey: knowledgeKeys.node(workspaceId, nodeId) })
          } else if (companyId) {
            await updateNodeApiV1CompaniesCompanyIdKnowledgeNodesNodeIdPatch({
              path: { company_id: companyId, node_id: nodeId },
              body: body as never,
              throwOnError: true,
            })
            await qc.refetchQueries({ queryKey: companyKnowledgeKeys.graph(companyId) })
            qc.invalidateQueries({ queryKey: companyKnowledgeKeys.node(companyId, nodeId) })
          }
        } else if (action.action_type === 'create_edge') {
          const body = {
            source_node_id: action.payload.source_id as number,
            target_node_id: action.payload.target_id as number,
            label: action.payload.label as string,
          }
          if (workspaceId) {
            await createEdgeApiV1WorkspacesWorkspaceIdKnowledgeEdgesPost({
              path: { workspace_id: workspaceId },
              body,
              throwOnError: true,
            })
            qc.invalidateQueries({ queryKey: knowledgeKeys.graph(workspaceId) })
          } else if (companyId) {
            await createEdgeApiV1CompaniesCompanyIdKnowledgeEdgesPost({
              path: { company_id: companyId },
              body,
              throwOnError: true,
            })
            qc.invalidateQueries({ queryKey: companyKnowledgeKeys.graph(companyId) })
          }
        } else {
          notifications.show({ title: 'Ошибка', message: 'Неизвестный тип действия', color: 'red' })
          return false
        }

        updateActionStatus(messageId, action.id, 'applied')
        notifications.show({
          title: 'Готово',
          message: SUCCESS_MESSAGES[action.action_type] ?? 'Действие выполнено',
          color: 'green',
        })
        return true
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        notifications.show({
          title: 'Ошибка',
          message: detail || 'Не удалось выполнить действие',
          color: 'red',
        })
        return false
      }
    },
    [workspaceId, companyId, focusedNodeId, qc, updateActionStatus],
  )

  const rejectAction = useCallback(
    (messageId: string, actionId: string) => {
      updateActionStatus(messageId, actionId, 'rejected')
    },
    [updateActionStatus],
  )

  return { applyAction, rejectAction }
}
